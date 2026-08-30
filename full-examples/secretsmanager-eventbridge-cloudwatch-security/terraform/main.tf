locals {
  metric_namespace      = "SecurityMonitoring"
  metric_name           = "SecurityIssue"
  failed_login_filter   = "failed-logins"
  rotation_max_age_days = 30
}

data "archive_file" "lambda" {
  type        = "zip"
  source_dir  = "${path.module}/../dist"
  output_path = "${path.module}/lambda.zip"
}

resource "aws_cloudwatch_log_group" "security_fn" {
  name              = "/aws/lambda/${var.name}"
  retention_in_days = 1
}

resource "aws_iam_role" "security_fn" {
  name = "${var.name}-fn"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "security_fn" {
  role = aws_iam_role.security_fn.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "${aws_cloudwatch_log_group.security_fn.arn}:*"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:DescribeSecret",
          "secretsmanager:GetSecretValue",
          "secretsmanager:PutSecretValue",
          "secretsmanager:UpdateSecretVersionStage",
        ]
        Resource = aws_secretsmanager_secret.demo.arn
      },
      {
        Effect   = "Allow"
        Action   = "secretsmanager:GetRandomPassword"
        Resource = "*"
      },
      {
        Effect    = "Allow"
        Action    = "cloudwatch:PutMetricData"
        Resource  = "*"
        Condition = { StringEquals = { "cloudwatch:namespace" = local.metric_namespace } }
      },
    ]
  })
}

resource "aws_lambda_function" "security_fn" {
  function_name    = var.name
  role             = aws_iam_role.security_fn.arn
  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  memory_size      = 512
  timeout          = 30

  logging_config {
    log_format = "JSON"
    log_group  = aws_cloudwatch_log_group.security_fn.name
  }

  environment {
    variables = {
      NODE_OPTIONS          = "--enable-source-maps"
      SECRET_ARN            = aws_secretsmanager_secret.demo.arn
      FAILED_LOGIN_FILTER   = local.failed_login_filter
      METRIC_NAMESPACE      = local.metric_namespace
      METRIC_NAME           = local.metric_name
      ROTATION_MAX_AGE_DAYS = tostring(local.rotation_max_age_days)
    }
  }
}

resource "random_password" "demo" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "demo" {
  name                    = "${var.name}/demo-api-key"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "demo" {
  secret_id     = aws_secretsmanager_secret.demo.id
  secret_string = random_password.demo.result
}

resource "aws_lambda_permission" "secrets_manager" {
  statement_id  = "AllowSecretsManagerRotation"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.security_fn.function_name
  principal     = "secretsmanager.amazonaws.com"
  source_arn    = aws_secretsmanager_secret.demo.arn
}

resource "aws_secretsmanager_secret_rotation" "demo" {
  secret_id           = aws_secretsmanager_secret.demo.id
  rotation_lambda_arn = aws_lambda_function.security_fn.arn
  rotate_immediately  = false

  rotation_rules {
    automatically_after_days = local.rotation_max_age_days
  }

  depends_on = [aws_lambda_permission.secrets_manager, aws_secretsmanager_secret_version.demo]
}

resource "aws_cloudwatch_event_rule" "rotation_age" {
  name                = "${var.name}-rotation-age"
  schedule_expression = "rate(1 hour)"
}

resource "aws_cloudwatch_event_target" "rotation_age" {
  rule = aws_cloudwatch_event_rule.rotation_age.name
  arn  = aws_lambda_function.security_fn.arn
}

resource "aws_lambda_permission" "events" {
  statement_id  = "AllowEventBridgeSchedule"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.security_fn.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.rotation_age.arn
}

resource "aws_cloudwatch_log_group" "app" {
  name              = "/${var.name}/app"
  retention_in_days = 1
}

resource "aws_lambda_permission" "logs" {
  statement_id  = "AllowLogsSubscription"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.security_fn.function_name
  principal     = "logs.amazonaws.com"
  source_arn    = "${aws_cloudwatch_log_group.app.arn}:*"
}

resource "aws_cloudwatch_log_subscription_filter" "failed_logins" {
  name            = local.failed_login_filter
  log_group_name  = aws_cloudwatch_log_group.app.name
  filter_pattern  = "FAILED_LOGIN"
  destination_arn = aws_lambda_function.security_fn.arn

  depends_on = [aws_lambda_permission.logs]
}

resource "aws_cloudwatch_metric_alarm" "security_issue" {
  alarm_name          = "${var.name}-security-issue"
  alarm_description   = "A handler found a security issue"
  namespace           = local.metric_namespace
  metric_name         = local.metric_name
  statistic           = "Sum"
  period              = 60
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
}
