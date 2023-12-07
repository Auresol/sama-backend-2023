import client from './samaDBConnect.mjs';
import outputTransform from './miscellaneous.mjs';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

export const lambdaHandler = async (event, context) => {

    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    };

    const tableName = process.env.ACT_TABLE;

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


    return ({
        "statusCode": 400,
        "body": "Error : " + error,
        "headers" : headers
    });       

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

    if(response.Count == 1){

        const returnBody = outputTransform(response.Items);

        return ({
            "statusCode": 200,
            "body": JSON.stringify(returnBody),
            "headers" : headers
        });
    }

    return ({
        "statusCode": 400,
        "body": "Not Found",
        "headers" : headers
    });

};



