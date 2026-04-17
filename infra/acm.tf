resource "aws_acm_certificate" "app" {
  provider          = aws.us_east_1
  domain_name       = var.app_domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-app"
  })
}

resource "cloudflare_dns_record" "app_certificate_validation" {
  for_each = var.manage_cloudflare_dns ? {
    for option in aws_acm_certificate.app.domain_validation_options : option.domain_name => {
      name  = option.resource_record_name
      type  = option.resource_record_type
      value = option.resource_record_value
    }
  } : {}

  zone_id = var.cloudflare_zone_id
  name    = each.value.name
  type    = each.value.type
  content = each.value.value
  ttl     = 60
  proxied = false
}

resource "aws_acm_certificate_validation" "app" {
  provider = aws.us_east_1
  count    = var.manage_cloudflare_dns ? 1 : 0

  certificate_arn = aws_acm_certificate.app.arn
  validation_record_fqdns = [
    for record in cloudflare_dns_record.app_certificate_validation : record.name
  ]
}
