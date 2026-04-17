data "tfe_outputs" "baseinfra" {
  organization = var.baseinfra_organization
  workspace    = var.baseinfra_workspace_name
}
