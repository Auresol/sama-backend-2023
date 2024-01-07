import client from './samaDBConnect.mjs';
import { QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

export const lambdaHandler = async (event, context) => {

    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    };

    const tableName = process.env.ACT_TABLE;

    let command;
    
    //Get email from path
    const requestPath = event.pathParameters;     
    const school = requestPath.school;          //Require
    const email = requestPath.email;

    command = {
        TableName: tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :email",
        ExpressionAttributeValues: {
            ":email" : email,
        },

    }

    let response;

    try {

        response = await client.send(new QueryCommand(command));
        
        if(response.Count == 0){

            command.IndexName = "GSI2";
            command.KeyConditionExpression = "GSI2PK = :email",
            
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

    if(response.Count == 0){

        return ({
            "statusCode": 400,
            "body": "Not Found",
            "headers" : headers
        });
    }

    let batchNumber = 0;
    const deleteChuck = chunkArray25(response.Items, 25);

    for (const chunk of deleteChuck) {

        const deleteRequests = chunk.map((item) => ({
            DeleteRequest: {
                Key : {
                    PK : school,
                    SK : item.SK
                }
            },
        }));
    
        const batchDeleteCommand = new BatchWriteCommand({
            RequestItems: {
                [tableName]: deleteRequests,
            },
        });

        batchNumber = batchNumber + 1;

        const batchDeleteResponse = await client.send(batchDeleteCommand);

        if(batchDeleteResponse.UnprocessedItems != {}){
            console.log("Batch : " + batchNumber + " -> unprocessed items :");
            console.log(batchDeleteResponse.UnprocessedItems);

        }else{
            console.log("Batch : " + batchNumber + " -> OK");

        }

    }
    
    return ({
        "statusCode": 400,
        "body": "Delete account successful",
        "headers" : headers
    });

};

// Amazon Codewhisperer wrote this in 3 second, wow (a little but of bug is presented, that's ok)
function chunkArray25(myArray){
    let index = 0;
    let arrayLength = myArray.length;
    let tempArray = [];
    
    for (index = 0; index < arrayLength; index += 25) {
        const myChunk = myArray.slice(index, index + 25);
        // Do something if you want with the group
        tempArray.push(myChunk);
    }

    return tempArray;
};



