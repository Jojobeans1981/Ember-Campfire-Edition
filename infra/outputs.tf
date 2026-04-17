output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for frontend deploy invalidations."
  value       = aws_cloudfront_distribution.app.id
}

output "cloudfront_distribution_domain_name" {
  description = "CloudFront domain name for manual Cloudflare DNS setup."
  value       = aws_cloudfront_distribution.app.domain_name
}

output "frontend_bucket_name" {
  description = "Frontend S3 bucket name."
  value       = aws_s3_bucket.frontend.bucket
}

output "backend_ecr_repository_name" {
  description = "Backend ECR repository name."
  value       = aws_ecr_repository.backend.name
}

output "backend_ecr_repository_url" {
  description = "Backend ECR repository URL."
  value       = aws_ecr_repository.backend.repository_url
}

output "backend_ecs_cluster_name" {
  description = "Backend ECS cluster name."
  value       = aws_ecs_cluster.backend.name
}

output "backend_ecs_service_name" {
  description = "Backend ECS service name."
  value       = aws_ecs_service.backend.name
}

output "backend_target_group_arn" {
  description = "ALB target group ARN for the Ember backend."
  value       = aws_lb_target_group.backend.arn
}

output "backend_runtime_secret_arn" {
  description = "Secrets Manager ARN that stores the backend runtime configuration."
  value       = aws_secretsmanager_secret.backend_runtime.arn
}

output "app_certificate_arn" {
  description = "ACM certificate ARN for app.readwithember.com."
  value       = aws_acm_certificate.app.arn
}

output "app_certificate_validation_records" {
  description = "Create these DNS records in Cloudflare when manage_cloudflare_dns is false."
  value = [
    for option in aws_acm_certificate.app.domain_validation_options : {
      domain_name  = option.domain_name
      record_name  = option.resource_record_name
      record_type  = option.resource_record_type
      record_value = option.resource_record_value
    }
  ]
}

output "app_cloudflare_dns_record" {
  description = "Manual Cloudflare DNS record needed to point the public app hostname at CloudFront."
  value = {
    name    = var.app_domain_name
    type    = "CNAME"
    content = aws_cloudfront_distribution.app.domain_name
    proxied = false
  }
}

output "backend_database_endpoint" {
  description = "RDS endpoint hostname for Ember backend PostgreSQL."
  value       = aws_db_instance.backend.address
}

output "cognito_user_pool_id" {
  description = "Cognito user pool ID for future frontend and backend auth integration."
  value       = aws_cognito_user_pool.app.id
}

output "cognito_user_pool_client_id" {
  description = "Cognito SPA app client ID for future auth integration."
  value       = aws_cognito_user_pool_client.spa.id
}
