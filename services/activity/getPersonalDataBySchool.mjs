import client from './samaDBConnect.mjs';
import outputTransform from './miscellaneous.mjs';
import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

export const lambdaHandler = async (event, context) => {

    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    };

    try{
        const tableName = process.env.ACT_TABLE;

        const requestPath = event.pathParameters; 

        const school = requestPath.school;          //Require
        const SK = requestPath.email;            //Require   

        const command = new GetCommand({
            TableName: tableName,
            Key : {
                "PK" : school,
                "SK" : SK
            }

        });

        const response = await client.send(command);

        if(response.Count == 0){
            return ({
                "statusCode": 400,
                "body": "Not found",
                "headers" : headers
            });                      
        }

        if(response.Items[0].PK != school){
            return ({
                "statusCode": 400,
                "body": "Unauthorize for that school",
                "headers" : headers
            });            
        }

        const returnBody = outputTransform([response.Item]);

        return ({
            "statusCode": 200,
            "body": JSON.stringify(response),
            "headers" : headers
        });

    }catch (error){
        return ({
            "statusCode": 400,
            "body": "Error : " + error,
            "headers" : headers
        });
    }
    
    

    
};



