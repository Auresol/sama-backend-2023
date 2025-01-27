import client from './samaDBConnect.mjs';
import outputTransform from './miscellaneous.mjs';
import { QueryCommand } from "@aws-sdk/lib-dynamodb";

export const lambdaHandler = async (event, context) => {

    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    };

    const tableName = process.env.ACT_TABLE;

    const requestPath = event.pathParameters;    
    const requestQueryString = event.queryStringParameters;

    const school = requestPath.school;                  //Require

    let type;
    let classroom;

    try{
        type = requestQueryString.type;                //Require
        classroom = requestQueryString.classroom;       //Optional

    }catch{
        type = undefined;
        classroom = undefined;

    }

    let response;
    let returnBody;

    if(type == undefined){

        // query ALL persona presented in school

        const commandSTD = {
            
            TableName: tableName,
            KeyConditionExpression: "PK = :school AND begins_with(SK, :type)",
            ExpressionAttributeValues: {
                ":school" : school,
                ":type" : "STD" + (classroom == undefined? "":"_" + classroom)     
            },

        };

        const commandTCH = {
            
            TableName: tableName,
            KeyConditionExpression: "PK = :school AND begins_with(SK, :type)",
            ExpressionAttributeValues: {
                ":school" : school,
                ":type" : "TCH" + (classroom == undefined? "":"_" + classroom)     
            },

        };

        const commandADMIN = {
            
            TableName: tableName,
            KeyConditionExpression: "PK = :school AND begins_with(SK, :type)",
            ExpressionAttributeValues: {
                ":school" : school,
                ":type" : "ADMIN" + (classroom == undefined? "":"_" + classroom)     
            },

        };

        response = (await client.send(new QueryCommand(commandSTD))).Items;
        response = response.concat((await client.send(new QueryCommand(commandTCH))).Items);
        response = response.concat((await client.send(new QueryCommand(commandADMIN))).Items);

        returnBody = outputTransform(response);

    }else{

        const command = {
            
            TableName: tableName,
            KeyConditionExpression: "PK = :school AND begins_with(SK, :type)",
            ExpressionAttributeValues: {
                ":school" : school,
                ":type" : type + (classroom == undefined? "":"_" + classroom)     
            },

        };


        response = await client.send(new QueryCommand(command));

        returnBody = outputTransform(response.Items);
    }

    return ({
        "statusCode": 200,
        "body": JSON.stringify(returnBody),
        "headers" : headers
    });
        
};



