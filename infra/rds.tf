resource "random_password" "db" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_db_subnet_group" "backend" {
  name       = "${local.name_prefix}-backend"
  subnet_ids = local.database_subnet_ids

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-backend"
  })
}

resource "aws_security_group" "rds" {
  name        = "${local.name_prefix}-rds"
  description = "Allow Ember backend tasks to connect to PostgreSQL."
  vpc_id      = data.tfe_outputs.baseinfra.values.vpc_id

  ingress {
    description     = "PostgreSQL from ECS tasks"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.backend.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-rds"
  })
}

resource "aws_db_instance" "backend" {
  identifier                 = "${local.name_prefix}-backend"
  allocated_storage          = var.db_allocated_storage
  max_allocated_storage      = var.db_max_allocated_storage
  engine                     = "postgres"
  engine_version             = "16"
  instance_class             = var.db_instance_class
  db_name                    = var.db_name
  username                   = var.db_username
  password                   = random_password.db.result
  db_subnet_group_name       = aws_db_subnet_group.backend.name
  vpc_security_group_ids     = [aws_security_group.rds.id]
  backup_retention_period    = var.db_backup_retention_period
  storage_encrypted          = true
  storage_type               = "gp3"
  publicly_accessible        = false
  multi_az                   = false
  skip_final_snapshot        = true
  deletion_protection        = false
  auto_minor_version_upgrade = true
  apply_immediately          = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-backend"
  })
}
