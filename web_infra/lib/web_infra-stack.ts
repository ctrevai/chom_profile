import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfront_origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as iam from 'aws-cdk-lib/aws-iam';

export class WebInfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const domainName = 'trevai.com';
    const siteDomain = 'www' + '.' + domainName;

    // Find current hosted zone
    const zone = route53.HostedZone.fromLookup(this, 'Zone',
      {
        domainName: domainName,
      }
    );
    // Create a TLS/SSL certificate for HTTPS
    const certificate = new acm.Certificate(this, 'SiteCertificate',
      {
        domainName: domainName,
        validation: acm.CertificateValidation.fromDns(zone),
        subjectAlternativeNames: ['*.' + domainName],
      });

    certificate.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY)

    // Create an S3 bucket to store content
    const siteBucket = new s3.Bucket(this, 'siteBucket', {
      bucketName: siteDomain,
      //publicReadAccess: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      //blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      accessControl: s3.BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'error/index.html',
      enforceSSL: true,

    });

    const s3BucketPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [new iam.AnyPrincipal()],
      actions: ['s3:GetObject'],
      resources: [siteBucket.bucketArn + '/*'],
    });

    siteBucket.addToResourcePolicy(s3BucketPolicy);

    // Deploy the files from 'html-website' to S3

    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset('../html-website')],
      destinationBucket: siteBucket,
    });

    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      defaultRootObject: "index.html",
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/error/index.html",
          ttl: cdk.Duration.minutes(10),
        }
      ],
      defaultBehavior: {
        origin: new cloudfront_origins.S3Origin(siteBucket),
        compress: true,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      certificate: certificate,
      domainNames: [domainName, siteDomain],
      enabled: true,
      httpVersion: cloudfront.HttpVersion.HTTP2,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
    });

    //Create Route 53 alias record for Cloudfront distribution
    new route53.ARecord(this, 'WWWSiteAliasRecord', {
      zone,
      recordName: siteDomain,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
    });

    new route53.ARecord(this, 'SiteAliasRecord', {
      zone,
      recordName: domainName,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
    });

  }
}

