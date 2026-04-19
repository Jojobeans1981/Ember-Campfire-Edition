resource "cloudflare_dns_record" "app" {
  count = var.manage_cloudflare_dns ? 1 : 0

  zone_id = var.cloudflare_zone_id
  name    = var.app_domain_name
  type    = "CNAME"
  content = aws_cloudfront_distribution.app.domain_name
  ttl     = 1
  proxied = false
}

resource "cloudflare_dns_record" "alb_origin" {
  count = var.manage_cloudflare_dns ? 1 : 0

  zone_id = var.cloudflare_zone_id
  name    = local.alb_origin_domain_name
  type    = "CNAME"
  content = data.tfe_outputs.baseinfra.values.alb_dns_name
  ttl     = 1
  proxied = false
}
