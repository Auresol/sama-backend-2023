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

        const school = requestPath.school;              //Require
        const act_id = requestPath.act_id;               //Require

        const getRecordCommand = new GetCommand({
            TableName: tableName,
            Key : {
                "PK" : school,
                "SK" : act_id
            }
        });

        const getRecordResponse = await client.send(getRecordCommand);

        if(getRecordResponse.Item == undefined){

            return ({
                "statusCode": 200,
                "body": "Item does not exist",
                "headers" : headers
            });            
            
        }

        const returnBody = outputTransform([getRecordResponse.Item]);

        return ({
            "statusCode": 200,
            "body": JSON.stringify(returnBody),
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



