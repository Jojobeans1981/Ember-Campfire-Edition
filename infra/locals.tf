data "aws_caller_identity" "current" {}

locals {
  name_prefix             = var.project_name
  app_bucket_name         = var.app_domain_name
  alb_origin_domain_name  = var.alb_origin_domain_name
  cognito_domain_prefix   = lower("${local.name_prefix}-${var.environment}-auth-${data.aws_caller_identity.current.account_id}")
  cognito_domain_host     = "${local.cognito_domain_prefix}.auth.${var.aws_region}.amazoncognito.com"
  backend_repo_name       = "${local.name_prefix}-backend"
  backend_cluster_name    = "${local.name_prefix}-backend"
  backend_service_name    = "${local.name_prefix}-backend"
  backend_container_name  = "backend"
  backend_port            = 3001
  api_origin_header_name  = "x-ember-origin"
  api_origin_header_value = "app-api"
  database_subnet_ids     = length(try(data.tfe_outputs.baseinfra.values.data_subnet_ids, [])) > 0 ? data.tfe_outputs.baseinfra.values.data_subnet_ids : data.tfe_outputs.baseinfra.values.private_subnet_ids
  common_tags = merge(
    try(data.tfe_outputs.baseinfra.values.tags, {}),
    {
      Application = "Ember"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Project     = var.project_name
    }
  )
}
