variable "aws_region" {
  description = "AWS region for Ember application resources."
  type        = string
  default     = "us-east-2"
}

variable "project_name" {
  description = "Short Ember-specific resource prefix."
  type        = string
  default     = "ember"
}

variable "environment" {
  description = "Single deployment environment label."
  type        = string
  default     = "production"
}

variable "app_domain_name" {
  description = "Public application hostname served by CloudFront."
  type        = string
  default     = "app.readwithember.com"
}

variable "baseinfra_organization" {
  description = "Terraform Cloud organization that owns the shared base infrastructure workspace."
  type        = string
  default     = "DNSG4"
}

variable "baseinfra_workspace_name" {
  description = "Terraform Cloud workspace name for the shared base infrastructure outputs."
  type        = string
  default     = "g4-baseinfra"
}

variable "manage_cloudflare_dns" {
  description = "When true, Terraform manages Cloudflare DNS and ACM validation records."
  type        = bool
  default     = true
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for readwithember.com."
  type        = string
  default     = ""
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token with DNS edit permissions for optional Terraform-managed DNS records."
  type        = string
  sensitive   = true
  default     = null
}

variable "backend_image_tag" {
  description = "Backend image tag to deploy from ECR."
  type        = string
  default     = "bootstrap"
}

variable "backend_cpu" {
  description = "Fargate CPU units for the backend task."
  type        = number
  default     = 256
}

variable "backend_memory" {
  description = "Fargate memory in MiB for the backend task."
  type        = number
  default     = 512
}

variable "backend_desired_count" {
  description = "Desired backend task count. Starts at zero until a real image is ready."
  type        = number
  default     = 0
}

variable "alb_api_listener_rule_priority" {
  description = "HTTPS listener priority for forwarding CloudFront API requests to Ember backend targets."
  type        = number
  default     = 210
}

variable "db_name" {
  description = "Initial PostgreSQL database name."
  type        = string
  default     = "ember"
}

variable "db_username" {
  description = "PostgreSQL master username."
  type        = string
  default     = "ember"
}

variable "db_instance_class" {
  description = "RDS instance class for Ember PostgreSQL."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "Initial RDS storage in GiB."
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "RDS autoscaling storage ceiling in GiB."
  type        = number
  default     = 100
}

variable "db_backup_retention_period" {
  description = "Number of days to retain automated backups."
  type        = number
  default     = 7
}

variable "frontend_bucket_force_destroy" {
  description = "Allow force-destroy of the frontend bucket. Keep false for production safety."
  type        = bool
  default     = false
}

variable "terraform_workspace_name" {
  description = "Expected Terraform Cloud workspace name for this Ember stack. Used by CI only."
  type        = string
  default     = "ember-infra"
}
