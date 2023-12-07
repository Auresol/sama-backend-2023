import client from './samaDBConnect.mjs';
import outputTransform from './miscellaneous.mjs';
import { QueryCommand,PutCommand,UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

async function allActStructGetter(tableName, school){

    const getAllActStructCommand = {
        TableName: tableName,
        Key : {
            PK: school,
            SK: "DATA"
        }
    };

    let getAllActStructResponse;

    try{

        getAllActStructResponse = await client.send(new GetCommand(getAllActStructCommand));

    }catch (error){
        throw new Error(error);
    }

    if(getAllActStructResponse.Item == undefined){

        throw new Error("Item doesn't exist");      
        
    }  

    let all_act_struct = {};
    
    for(const item in getAllActStructResponse.Item){
        if(item.startsWith("act")){

            const act_type = item.split("_")[1];
            all_act_struct[act_type] = getAllActStructResponse.Item[item];
        }
    }

    return all_act_struct;

}

export const lambdaHandler = async (event, context) => {

    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    };


    const tableName = process.env.ACT_TABLE;
    
    const requestPath = event.pathParameters;    
    const requestBody = JSON.parse(event.body);

    const school = requestPath.school;                  //Require
    const std_email = requestPath.email;                //Require

    const act_type = requestBody.act_type;              //Require
    const act_data = requestBody.act_data;              //Require
    const act_done_time = requestBody.act_done_time;    //Require

    let all_act_struct;
    try{
        all_act_struct = await allActStructGetter(tableName, school);

    }catch (error){
        return ({
            "statusCode": 400,
            "body": "get act stuct error :" + error.message,
            "headers" : headers
        });       
    }

    //Don't send yet, just create
    const flag = "PENDING";


    //act_id doesn't exist if it's a new record -> create new act_id
    const currentDateTime = new Date().toISOString();  
    const act_id = "REC_" + currentDateTime + "_" + std_email;

    // Query to see the student data
    const getDataCommand = {
        TableName: tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :email AND GSISK = :datas",
        ExpressionAttributeValues: {
            ":email" : std_email,
            ":datas" : "DATA"
        },

    };

    let getDataResponse;

    try{

        getDataResponse = await client.send(new QueryCommand(getDataCommand));

    }catch (error){
        return ({
            "statusCode": 400,
            "body": "get personal data error : " + error,
            "headers" : headers
        });            
    }
    
    const std_SK = getDataResponse.Items[0].SK;
    const std_id = getDataResponse.Items[0].id;
    const std_number = getDataResponse.Items[0].number;

    const std_sk_split = std_SK.split("_");
    const name = std_sk_split[2].split(".");

    const std_firstname = name[0];
    const std_lastname = name[1];
    const std_classroom = std_sk_split[1];

    const act_stat = getDataResponse.Items[0]["stat_" + act_type];

    // reduce --> callback for each element in array --> in this case, it sums all value
    if(act_stat.reduce((a, b) => a + b, 0) >= all_act_struct[act_type].max){

        return ({
            "statusCode": 400,
            "body": "Record is full",
            "headers" : headers
        });

    }
    //put new data
    const recordPutCommand = {

        TableName: tableName,
        Item: {
            'PK': school,
            'SK': act_id,
            'GSI1PK' : std_email,
            'GSISK' : act_type + "_" + flag,

            'std_ID' : std_id,
            'std_number' : std_number,
            'std_firstname' : std_firstname,
            'std_lastname' : std_lastname,
            'std_classroom' : std_classroom,

            'act_create' : currentDateTime,
            'act_update' : currentDateTime,
            'act_type' : act_type,
            'act_data' : act_data,
            'act_done_time' : act_done_time
        },

    };

    // update a statistic
    const updateStatisticCommand = {

        TableName: tableName,
        Key: {
            "PK" : school,
            "SK" : std_SK
        },

        UpdateExpression: "ADD #h[0] :value",
        ExpressionAttributeNames: {
            "#h": "stat_" + act_type 
        },

        ExpressionAttributeValues: {
            ":value" : act_done_time
        }
    }

    let returnBody;

    try{

        const recordPutResponse = await client.send(new PutCommand(recordPutCommand));
        console.info({message : "New record inserted", rec_body : recordPutCommand});

        returnBody = outputTransform([recordPutCommand.Item]);

    }catch (error){
        return ({
            "statusCode": 400,
            "body": "create new record error : " + error,
            "headers" : headers
        });
    }

    try{

        const updateStatisticResponse = await client.send(new UpdateCommand(updateStatisticCommand));
        console.info({message : "Statistic updated", rec_body : updateStatisticCommand});

    }catch (error){
        return ({
            "statusCode": 400,
            "body": "update statistic error : " + error,
            "headers" : headers
        });
    }

    return ({
        "statusCode": 200,
        "body": JSON.stringify(returnBody),
        "headers" : headers
    });

};

