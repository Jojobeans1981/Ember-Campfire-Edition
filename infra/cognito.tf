resource "aws_cognito_user_pool" "app" {
  name = "${local.name_prefix}-app"

  auto_verified_attributes = ["email"]
  username_attributes      = ["email"]

  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 7
  }

  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  admin_create_user_config {
    allow_admin_create_user_only = false
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-app"
  })
}

resource "aws_cognito_user_pool_client" "spa" {
  name         = "${local.name_prefix}-spa"
  user_pool_id = aws_cognito_user_pool.app.id

  allowed_oauth_flows_user_pool_client          = true
  allowed_oauth_flows                           = ["code"]
  allowed_oauth_scopes                          = ["openid", "email", "profile"]
  callback_urls                                 = ["https://app.readwithember.com/auth/callback"]
  generate_secret                               = false
  logout_urls                                   = ["https://app.readwithember.com/"]
  prevent_user_existence_errors                 = "ENABLED"
  refresh_token_validity                        = 30
  access_token_validity                         = 60
  id_token_validity                             = 60
  auth_session_validity                         = 15
  enable_token_revocation                       = true
  enable_propagate_additional_user_context_data = false

  explicit_auth_flows = [
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_USER_PASSWORD_AUTH"
  ]

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  supported_identity_providers = ["COGNITO"]
}

resource "aws_cognito_user_pool_domain" "app" {
  domain       = local.cognito_domain_prefix
  user_pool_id = aws_cognito_user_pool.app.id
}
