import client from './samaDBConnect.mjs';
import { QueryCommand, BatchWriteCommand, DeleteCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

export const lambdaHandler = async (event, context) => {

    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    };

    const tableName = process.env.ACT_TABLE;

    let command;
    
    //Get email from path
    const requestPath = event.pathParameters;     
    const requestBody = JSON.parse(event.body);

    const school = requestPath.school;          //Require
    const email = requestPath.email;

    let new_email = requestBody.new_email;
    let new_id = requestBody.new_id;
    let new_firstname = requestBody.new_firstname;
    let new_lastname = requestBody.new_lastname;
    let new_classroom = requestBody.new_classroom;
    let new_number = requestBody.new_number;

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

    let personal_data_item = response.Items.pop();

    const SK = personal_data_item.SK;
    const sk_split = SK.split("_");
    const type = sk_split[0];
    const name = sk_split[2].split(".");

    new_firstname = new_firstname ?? name[0];
    new_lastname = new_lastname ?? name[1];
    new_id = new_id ?? personal_data_item.id;
    new_email = new_email ?? email;
    new_classroom = new_classroom ?? sk_split[1];
    new_number = new_number ?? personal_data_item.number;
    
    const new_DATA_SK = type + "_" + new_classroom + "_" + new_firstname + "." + new_lastname;

    const itemChuck = chunkArray25(response.Items, 25);

    console.log("DELETE OLD DATA");

    // delete the DATA row
    const dataDeleteCommand = {
        TableName: tableName,
        Key : {
            "PK" : school,
            "SK" : SK
        }
    }

    console.log(dataDeleteCommand);

    try{
        const dataDeleteResponse = await client.send(new DeleteCommand(dataDeleteCommand));

    }catch(error){

        return ({
            "statusCode": 400,
            "body": "DATA delete error : " + error,
            "headers" : headers
        });

    }

    // delete all record
    let batchNumber = 0;
    for (const chunk of itemChuck) {

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

    console.log("DELETION COMPLETE");
    console.log("CREATING NEW ELEMENT");

    // recreating new DATA
    personal_data_item.SK = new_DATA_SK;
    personal_data_item.id = new_id;
    personal_data_item.number = new_number;

    if(type == "STD"){
        personal_data_item.GSI1PK = new_email;

    }else{
        personal_data_item.GSI2PK = new_email;

    }

    const dataPutCommand = {
        TableName : tableName,
        Item : personal_data_item
    }

    try{
        const dataPutResponse = await client.send(new PutCommand(dataPutCommand));

    }catch(error){
        return ({
            "statusCode": 400,
            "body": "Put new DATA error : " + error,
            "headers" : headers
        });    

    }

    // recreating all record
    batchNumber = 0;
    for (const chunk of itemChuck) {

        let putRequests = {};

        for(let new_item of chunk){

            // new_item_num is int (position in the list), why?? -> use "in" instead of "of"
            // let new_item = chunk[new_item_num];

            new_item.SK = "REC_" + new_item.act_create + "_" + new_email;
            
            if(type == "STD"){

                new_item.GSI1PK = new_email;
                new_item.std_classroom = new_classroom;
                new_item.std_firstname = new_firstname;
                new_item.std_lastname = new_lastname;
                new_item.std_number = new_number;

            }else{

                new_item.GSI2PK = new_email;
                if(new_item.tch_name != undefined){
                    new_item.tch_name = new_firstname + " " + new_lastname;
                }
            }

            putRequests.push({PutRequest : {Item : {new_item}} });

        }
    
        const batchPutCommand = new BatchWriteCommand({
            RequestItems: {
                [tableName]: putRequests,
            },
        });

        batchNumber = batchNumber + 1;

        const batchPutResponse = await client.send(batchPutCommand);

        if(batchPutResponse.UnprocessedItems != {}){
            console.log("Batch : " + batchNumber + " -> unprocessed items :");
            console.log(batchDeleteResponse.UnprocessedItems);

        }else{
            console.log("Batch : " + batchNumber + " -> OK");

        }

    }

    return ({
        "statusCode": 400,
        "body": "Update account successful",
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



