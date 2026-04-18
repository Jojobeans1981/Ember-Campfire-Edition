data "aws_iam_policy_document" "ecs_task_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_ecs_cluster" "backend" {
  name = local.backend_cluster_name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = merge(local.common_tags, {
    Name = local.backend_cluster_name
  })
}

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/aws/ecs/${local.backend_service_name}"
  retention_in_days = 30

  tags = merge(local.common_tags, {
    Name = local.backend_service_name
  })
}

resource "aws_security_group" "backend" {
  name        = "${local.name_prefix}-backend"
  description = "Allow the shared ALB to reach Ember backend tasks."
  vpc_id      = data.tfe_outputs.baseinfra.values.vpc_id

  ingress {
    description     = "HTTP from the shared ALB"
    from_port       = local.backend_port
    to_port         = local.backend_port
    protocol        = "tcp"
    security_groups = [data.tfe_outputs.baseinfra.values.alb_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-backend"
  })
}

resource "aws_iam_role" "backend_execution" {
  name               = "${local.name_prefix}-backend-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume_role.json

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "backend_execution_managed" {
  role       = aws_iam_role.backend_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "backend_execution_secrets" {
  statement {
    actions = [
      "secretsmanager:GetSecretValue",
      "kms:Decrypt"
    ]

    resources = [
      aws_secretsmanager_secret.backend_runtime.arn,
      "*"
    ]
  }
}

resource "aws_iam_role_policy" "backend_execution_secrets" {
  name   = "${local.name_prefix}-backend-secrets"
  role   = aws_iam_role.backend_execution.id
  policy = data.aws_iam_policy_document.backend_execution_secrets.json
}

resource "aws_iam_role" "backend_task" {
  name               = "${local.name_prefix}-backend-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume_role.json

  tags = local.common_tags
}

resource "aws_lb_target_group" "backend" {
  name        = substr("${local.name_prefix}-backend", 0, 32)
  port        = local.backend_port
  protocol    = "HTTP"
  vpc_id      = data.tfe_outputs.baseinfra.values.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-backend"
  })
}

resource "aws_lb_listener_rule" "backend_api" {
  listener_arn = data.tfe_outputs.baseinfra.values.alb_listener_https_arn
  priority     = var.alb_api_listener_rule_priority

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    http_header {
      http_header_name = local.api_origin_header_name
      values           = [local.api_origin_header_value]
    }
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-backend-api"
  })
}

resource "aws_ecs_task_definition" "backend" {
  family                   = local.backend_service_name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = tostring(var.backend_cpu)
  memory                   = tostring(var.backend_memory)
  execution_role_arn       = aws_iam_role.backend_execution.arn
  task_role_arn            = aws_iam_role.backend_task.arn

  container_definitions = jsonencode([
    {
      name      = local.backend_container_name
      image     = "${aws_ecr_repository.backend.repository_url}:${var.backend_image_tag}"
      essential = true
      portMappings = [
        {
          containerPort = local.backend_port
          hostPort      = local.backend_port
          protocol      = "tcp"
        }
      ]
      environment = [
        {
          name  = "AUTH_PROVIDER"
          value = "cognito"
        },
        {
          name  = "HOST"
          value = "0.0.0.0"
        },
        {
          name  = "PORT"
          value = tostring(local.backend_port)
        },
        {
          name  = "CORS_ALLOWED_ORIGINS"
          value = "https://${var.app_domain_name}"
        }
      ]
      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = "${aws_secretsmanager_secret.backend_runtime.arn}:DATABASE_URL::"
        },
        {
          name      = "COGNITO_USER_POOL_ID"
          valueFrom = "${aws_secretsmanager_secret.backend_runtime.arn}:COGNITO_USER_POOL_ID::"
        },
        {
          name      = "COGNITO_USER_POOL_CLIENT_ID"
          valueFrom = "${aws_secretsmanager_secret.backend_runtime.arn}:COGNITO_USER_POOL_CLIENT_ID::"
        },
        {
          name      = "COGNITO_REGION"
          valueFrom = "${aws_secretsmanager_secret.backend_runtime.arn}:COGNITO_REGION::"
        },
        {
          name      = "COGNITO_DOMAIN"
          valueFrom = "${aws_secretsmanager_secret.backend_runtime.arn}:COGNITO_DOMAIN::"
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.backend.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = local.backend_container_name
        }
      }
    }
  ])

  tags = merge(local.common_tags, {
    Name = local.backend_service_name
  })
}

resource "aws_ecs_service" "backend" {
  name                               = local.backend_service_name
  cluster                            = aws_ecs_cluster.backend.id
  task_definition                    = aws_ecs_task_definition.backend.arn
  desired_count                      = var.backend_desired_count
  launch_type                        = "FARGATE"
  health_check_grace_period_seconds  = 60
  enable_execute_command             = true
  deployment_maximum_percent         = 200
  deployment_minimum_healthy_percent = 100

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = data.tfe_outputs.baseinfra.values.private_subnet_ids
    security_groups  = [aws_security_group.backend.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = local.backend_container_name
    container_port   = local.backend_port
  }

  depends_on = [aws_lb_listener_rule.backend_api]

  tags = merge(local.common_tags, {
    Name = local.backend_service_name
  })
}
