import client from './samaDBConnect.mjs';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";


export const lambdaHandler = async (event, context) => {

    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    };

    const tableName = process.env.ACT_TABLE;
    const region = process.env.REGION;
    const samaDataBucket = process.env.SAMA_DATA_BUCKET;

    let command;
    
    //Get email from path
    const requestPath = event.pathParameters;     
    const email = requestPath.email;

    command = {
        TableName: tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :email AND GSISK = :datas",
        ExpressionAttributeValues: {
            ":email" : email,
            ":datas" : "DATA"
        },

    }    

    let response;

    try {

        response = await client.send(new QueryCommand(command));
        
        if(response.Count == 0){

            command.IndexName = "GSI2";
            command.KeyConditionExpression = "GSI2PK = :email AND GSISK = :datas",
            
            response = await client.send(new QueryCommand(command));
        }
    
    } catch (error) {

        //console.error("DynamoDB GSI1 Error:", error);
        return ({
            "statusCode": 400,
            "body": "DynamoDB Error:" + error,
            "headers" : headers
        });

    }

    if(response.Count != 1){

        return ({
            "statusCode": 400,
            "body": "Not Found",
            "headers" : headers
        });
    }

    const school = response.Items[0].PK;

    const uploadKey = school + '/profile_pic/' + email.replace("@", ".") + '.jpeg';

    const clientUrl = await createPresignedUrlWithClient({
        region: region,
        bucket: samaDataBucket,
        key: uploadKey,
    });

    let returnMessage = "Upload";

    // if(response.Items[0].profile_img_path != undefined){
    //     returnMessage = "Profile already exists, replacing the picture";
    // }

    return ({
        "statusCode": 200,
        "body": JSON.stringify({"Message" : returnMessage, "Url" : clientUrl}),
        "headers" : headers
    });
};

const createPresignedUrlWithClient = ({ region, bucket, key }) => {
    const client = new S3Client({ region });
    const command = new PutObjectCommand({ Bucket: bucket, Key: key });
    return getSignedUrl(client, command, { expiresIn: 3600 });
};




