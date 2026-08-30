output "function_name" {
  value = aws_lambda_function.security_fn.function_name
}

output "secret_arn" {
  value = aws_secretsmanager_secret.demo.arn
}

output "app_log_group" {
  value = aws_cloudwatch_log_group.app.name
}

output "alarm_name" {
  value = aws_cloudwatch_metric_alarm.security_issue.alarm_name
}
