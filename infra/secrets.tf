resource "aws_secretsmanager_secret" "backend_runtime" {
  name                    = "${local.name_prefix}/backend/runtime"
  recovery_window_in_days = 0

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}/backend/runtime"
  })
}

resource "aws_secretsmanager_secret_version" "backend_runtime" {
  secret_id = aws_secretsmanager_secret.backend_runtime.id

  secret_string = jsonencode({
    DATABASE_URL                = format("postgres://%s:%s@%s:%d/%s", var.db_username, urlencode(random_password.db.result), aws_db_instance.backend.address, aws_db_instance.backend.port, var.db_name)
    DATABASE_HOST               = aws_db_instance.backend.address
    DATABASE_PORT               = aws_db_instance.backend.port
    DATABASE_NAME               = var.db_name
    DATABASE_USER               = var.db_username
    DATABASE_PASSWORD           = random_password.db.result
    COGNITO_USER_POOL_ID        = aws_cognito_user_pool.app.id
    COGNITO_USER_POOL_CLIENT_ID = aws_cognito_user_pool_client.spa.id
    COGNITO_REGION              = var.aws_region
  })
}
