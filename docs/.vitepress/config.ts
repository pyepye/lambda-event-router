import { defineConfig } from 'vitepress';

const base = '/latcher/'; // '/' If we move to a custom domain

export default defineConfig({
  srcExclude: ['README.md'],
  title: 'Latcher',
  description: 'Type-safe event routing for AWS Lambda events',
  base,
  cleanUrls: true,
  head: [['link', { rel: 'icon', href: `${base}latcher.svg` }]],
  themeConfig: {
    logo: {
      light: '/latcher-light.svg',
      dark: '/latcher-dark.svg',
      alt: 'Latcher',
    },
    siteTitle: 'Latcher',
    search: { provider: 'local' },
    outline: [2, 3],
    nav: [
      { text: 'Packages', link: '/packages' },
      { text: 'Docs', link: '/docs/' },
      { text: 'Examples', link: '/examples/' },
      { text: 'About', link: '/about' },
    ],
    sidebar: {
      '/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Overview', link: '/docs/' },
            { text: 'Quick Start', link: '/docs/quick-start' },
            { text: 'Matchers', link: '/docs/matchers' },
            { text: 'Routing / Filtering', link: '/docs/routing' },
            { text: 'Handlers', link: '/docs/handlers' },
            { text: 'Middleware', link: '/docs/middleware' },
            { text: 'Logging', link: '/docs/logging' },
          ],
        },
        {
          text: 'Matchers',
          items: [
            { text: 'Latcher', link: '/matchers/Latcher' },
            { text: 'EventMatcher', link: '/matchers/EventMatcher' },
            { text: 'APIGatewayMatcher', link: '/matchers/APIGatewayMatcher' },
            { text: 'WebSocketMatcher (API Gateway)', link: '/matchers/WebSocketMatcher' },
            { text: 'LambdaAuthorizerMatcher (API Gateway)', link: '/matchers/LambdaAuthorizerMatcher' },
            { text: 'ActiveMQMatcher', link: '/matchers/ActiveMQMatcher' },
            { text: 'ALBMatcher', link: '/matchers/ALBMatcher' },
            { text: 'AppSyncAuthorizerMatcher', link: '/matchers/AppSyncAuthorizerMatcher' },
            { text: 'AppSyncEventsAuthorizerMatcher', link: '/matchers/AppSyncEventsAuthorizerMatcher' },
            { text: 'AppSyncEventsMatcher', link: '/matchers/AppSyncEventsMatcher' },
            { text: 'AppSyncMatcher', link: '/matchers/AppSyncMatcher' },
            { text: 'CloudWatchLogsMatcher', link: '/matchers/CloudWatchLogsMatcher' },
            { text: 'CodeCommitMatcher', link: '/matchers/CodeCommitMatcher' },
            { text: 'CodePipelineMatcher', link: '/matchers/CodePipelineMatcher' },
            { text: 'CognitoMatcher', link: '/matchers/CognitoMatcher' },
            { text: 'ConfigMatcher', link: '/matchers/ConfigMatcher' },
            { text: 'ConfigScheduledMatcher', link: '/matchers/ConfigScheduledMatcher' },
            { text: 'ConnectMatcher', link: '/matchers/ConnectMatcher' },
            { text: 'DocumentDBMatcher', link: '/matchers/DocumentDBMatcher' },
            { text: 'DynamoDBMatcher', link: '/matchers/DynamoDBMatcher' },
            { text: 'EventBridgeMatcher', link: '/matchers/EventBridgeMatcher' },
            { text: 'FirehoseMatcher', link: '/matchers/FirehoseMatcher' },
            { text: 'KafkaMatcher', link: '/matchers/KafkaMatcher' },
            { text: 'KinesisMatcher', link: '/matchers/KinesisMatcher' },
            { text: 'LexMatcher', link: '/matchers/LexMatcher' },
            { text: 'RabbitMQMatcher', link: '/matchers/RabbitMQMatcher' },
            { text: 'S3BatchMatcher', link: '/matchers/S3BatchMatcher' },
            { text: 'S3Matcher', link: '/matchers/S3Matcher' },
            { text: 'SecretsManagerMatcher', link: '/matchers/SecretsManagerMatcher' },
            { text: 'SESMatcher', link: '/matchers/SESMatcher' },
            { text: 'SNSMatcher', link: '/matchers/SNSMatcher' },
            { text: 'SQSMatcher', link: '/matchers/SQSMatcher' },
            { text: 'StepFunctionsMatcher', link: '/matchers/StepFunctionsMatcher' },
            { text: 'VPCLatticeMatcher', link: '/matchers/VPCLatticeMatcher' },
          ],
        },
        {
          text: 'Testing',
          items: [{ text: 'Testing', link: '/testing/' }],
        },
        {
          text: 'Examples',
          items: [
            { text: 'Service examples', link: '/examples/' },
            { text: 'Full examples', link: '/examples/full-examples' },
          ],
        },
      ],
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/pyepye/latcher' }],
    footer: {
      copyright: `Copyright © ${new Date().getFullYear()} Matt Pye`,
    },
  },
});
