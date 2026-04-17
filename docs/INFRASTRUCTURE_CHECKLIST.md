# Infrastructure Checklist

## Scope

- [x] Build a new Ember-only infra stack in this repo for one environment.
- [x] Consume shared network and load balancer outputs from Terraform Cloud workspace `DNSG4/g4-baseinfra`.

## Target Architecture

- [ ] Serve the public app at `https://app.readwithember.com`.
- [x] Host the frontend on `S3 + CloudFront`.
- [ ] Route backend requests through `https://app.readwithember.com/api/*`.
- [x] Configure CloudFront `/api/*` behavior to use the existing ALB as the origin.
- [x] Add a CloudFront Function that rewrites `/api/...` to backend root routes `/...`.
- [x] Run the backend on `ECS/Fargate`.
- [x] Add `RDS PostgreSQL` using `db.t4g.micro`.
- [x] Provision `Cognito` user pool and SPA app client.
- [x] Store backend secrets in `Secrets Manager`.
- [x] Store backend images in `ECR`.
- [x] Start with manual Cloudflare DNS updates.
- [x] Prepare optional Terraform-managed Cloudflare support for later.

## Terraform Structure

- [x] Create `infra/versions.tf`.
- [x] Create `infra/providers.tf`.
- [x] Create `infra/variables.tf`.
- [x] Create `infra/locals.tf`.
- [x] Create `infra/remote_state.tf`.
- [x] Create `infra/acm.tf`.
- [x] Create `infra/frontend.tf`.
- [x] Create `infra/ecr.tf`.
- [x] Create `infra/ecs.tf`.
- [x] Create `infra/rds.tf`.
- [x] Create `infra/secrets.tf`.
- [x] Create `infra/cognito.tf`.
- [x] Create `infra/cloudflare.tf`.
- [x] Create `infra/outputs.tf`.

## Shared Inputs

- [x] Consume `tags` from `DNSG4/g4-baseinfra`.
- [x] Consume `aws_region` from `DNSG4/g4-baseinfra`.
- [x] Consume `vpc_id` from `DNSG4/g4-baseinfra`.
- [x] Consume `private_subnet_ids` from `DNSG4/g4-baseinfra`.
- [x] Consume `data_subnet_ids` from `DNSG4/g4-baseinfra`.
- [x] Consume `alb_security_group_id` from `DNSG4/g4-baseinfra`.
- [x] Consume `alb_arn` from `DNSG4/g4-baseinfra`.
- [x] Consume `alb_dns_name` from `DNSG4/g4-baseinfra`.
- [x] Consume `alb_zone_id` from `DNSG4/g4-baseinfra`.
- [x] Consume `alb_listener_https_arn` from `DNSG4/g4-baseinfra`.
- [x] Ignore public hosted zone outputs from the base infra workspace.

## Certificates

- [x] Create a new ACM certificate in `us-east-1` for `app.readwithember.com`.
- [x] Surface ACM validation CNAME records as Terraform outputs.
- [x] Use manual Cloudflare DNS validation at first.
- [x] Keep the design ready for later Terraform-managed Cloudflare validation records.

## Frontend Infrastructure

- [x] Create a private S3 bucket for frontend assets.
- [x] Create a CloudFront OAC for bucket access.
- [x] Create a CloudFront distribution for `app.readwithember.com`.
- [x] Configure the default CloudFront behavior to use the S3 bucket.
- [x] Configure a `/api/*` CloudFront behavior to use the ALB.
- [x] Disable API caching for `/api/*`.
- [x] Forward `Authorization` to the API origin.
- [x] Forward query strings to the API origin.
- [x] Forward any required API headers to the origin.
- [x] Add the CloudFront Function that strips only the leading `/api` prefix.

## Backend Infrastructure

- [x] Create an ECR repository for backend images.
- [x] Create an ECS cluster.
- [x] Create an ECS task execution role.
- [x] Create an ECS task role.
- [x] Create a CloudWatch log group for the backend.
- [x] Create a security group for ECS tasks.
- [x] Create an ALB target group for the backend service.
- [x] Add an HTTPS listener rule to the existing ALB listener.
- [x] Create an ECS task definition for the backend.
- [x] Create the ECS service immediately with `desired_count = 0`.

## Database Infrastructure

- [x] Create a DB subnet group.
- [x] Create a security group for RDS.
- [x] Create a PostgreSQL RDS instance using `db.t4g.micro`.
- [x] Place the database in private or data subnets only.
- [x] Keep the database non-public.
- [x] Enable storage encryption.
- [x] Generate database credentials.

## Secrets

- [x] Create a Secrets Manager secret for backend configuration.
- [x] Store `DATABASE_URL` in the secret.
- [x] Store `DATABASE_HOST` in the secret.
- [x] Store `DATABASE_PORT` in the secret.
- [x] Store `DATABASE_NAME` in the secret.
- [x] Store `DATABASE_USER` in the secret.
- [x] Store `DATABASE_PASSWORD` in the secret.
- [x] Leave room for later Cognito backend values in the same secret or a follow-up secret.

## Cognito

- [x] Create a Cognito user pool.
- [x] Create a Cognito SPA app client.
- [x] Defer Cognito hosted domain creation for now.

## Backend Runtime Configuration

- [x] Configure `HOST=0.0.0.0`.
- [x] Configure `PORT=3001`.
- [x] Configure `DATABASE_URL`.
- [x] Configure `CORS_ALLOWED_ORIGINS=https://app.readwithember.com`.
- [x] Leave room for future Cognito backend configuration.

## Terraform Variables

- [x] Add `app_domain_name` with default `app.readwithember.com`.
- [x] Add `backend_image_tag`.
- [x] Add `manage_cloudflare_dns` with default `false`.
- [x] Add `cloudflare_zone_id`.
- [x] Add Terraform Cloud sensitive env var support for `CLOUDFLARE_API_TOKEN`.

## Cloudflare

- [x] Output the CloudFront target for `app.readwithember.com`.
- [x] Output ACM validation CNAME records for manual creation in Cloudflare.
- [x] Add optional Terraform-managed Cloudflare resources behind `manage_cloudflare_dns`.
- [x] Use `cloudflare_zone_id` when Terraform-managed Cloudflare DNS is enabled.
- [x] Use `CLOUDFLARE_API_TOKEN` when Terraform-managed Cloudflare DNS is enabled.

## GitHub Actions

- [x] Add a backend image workflow.
- [x] Trigger the backend image workflow on backend changes and manual dispatch.
- [x] Have the backend image workflow assume `GH_AWS_DEPLOYER_ROLE`.
- [x] Make the backend image workflow verify the ECR repo exists.
- [x] Build and push the backend image tagged with the short commit SHA.
- [x] Add a Terraform workflow.
- [x] Trigger the Terraform workflow on `infra/**` changes and manual dispatch.
- [x] Have the Terraform workflow use `TF_API_KEY`.
- [x] Run Terraform plan on pull requests.
- [x] Run Terraform apply on merge or manual approval.
- [x] Pass `backend_image_tag` into Terraform when available.
- [x] Add a frontend deploy workflow.
- [x] Trigger the frontend deploy workflow on frontend changes and manual dispatch.
- [x] Build the frontend with `VITE_API_BASE_URL=/api`.
- [x] Make the frontend deploy workflow verify the bucket and distribution exist.
- [x] Sync `dist/` to S3.
- [x] Invalidate CloudFront after deploy.

## Safety Rules

- [x] Keep the ECS service at `desired_count = 0` until a real image is ready.
- [x] Allow Terraform to succeed before any backend image exists.
- [x] Allow the frontend to go live before the backend is enabled.
- [x] Make workflows fail clearly when required infrastructure is missing.

## Auth Caveat

- [x] Provision Cognito infra now.
- [x] Track that production auth cutover still requires later app code changes.
- [x] Track that the frontend currently still uses dev bearer-token auth.
- [x] Track that the backend currently still validates `Bearer dev:*` tokens.

## Manual Cloudflare Tasks

- [x] Find the Cloudflare zone ID for `readwithember.com` in the Cloudflare dashboard.
- [ ] Create the DNS record for `app.readwithember.com` pointing to the CloudFront target.
- [ ] Create the ACM validation CNAME records in Cloudflare.

## Validation Checklist

- [ ] Confirm Terraform can read all required base infra outputs.
- [ ] Confirm ACM outputs provide the correct Cloudflare validation records.
- [ ] Confirm `app.readwithember.com` serves the frontend from CloudFront.
- [ ] Confirm `/api/health` reaches the backend health endpoint through the rewrite.
- [ ] Confirm ECS tasks can connect to RDS.
- [ ] Confirm backend logs appear in CloudWatch.
- [ ] Confirm frontend deploy uploads and invalidates correctly.
- [ ] Confirm backend image workflow pushes to ECR.
- [ ] Confirm Terraform apply succeeds before any image exists.
