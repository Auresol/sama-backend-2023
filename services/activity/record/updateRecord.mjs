import client from './samaDBConnect.mjs';
import outputTransform from './miscellaneous.mjs';
import { UpdateCommand,GetCommand } from "@aws-sdk/lib-dynamodb";

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
    const act_id = requestPath.act_id;                  //Require

    const act_data = requestBody.act_data;              //Optional
    const tch_name = requestBody.tch_name;              //Optional
    const tch_email = requestBody.tch_email;            //Optional

    const flag = requestBody.flag;                      //Optional

    //console.info(school + ", " + std_email + ", " + act_id + ", " + std_SK + ", " + act_type + ", " + act_data + ", " + tch_name + ", " + old_flag +", " + flag);

    const typeDetect = {
        "PENDING" : 0,   
        "SEND" : 1,  
        "ACCEPT" : 2,    
        "REJECT" : 3     
    }


    // Query to see if act_id exist
    const getRecordCommand = new GetCommand({
        TableName: tableName,
        Key : {
            "PK" : school,
            "SK" : act_id
        }
    });

    const getRecordResponse = await client.send(getRecordCommand);

    // if act_id don't exist, return
    if(getRecordResponse.Item == undefined){

        return ({
            "statusCode": 400,
            "body": "Record not found",
            "headers" : headers
        });

    }  

    const flag_gsisk_split = getRecordResponse.Item.GSISK.split("_");

    const act_type = flag_gsisk_split[0];
    const old_flag = flag_gsisk_split[1];
    const act_done_time = parseInt(getRecordResponse.Item.act_done_time);
    const std_SK = "STD_" + getRecordResponse.Item.std_classroom + "_" + getRecordResponse.Item.std_firstname + "." + getRecordResponse.Item.std_lastname;

    //update the record data
    const recordUpdateCommand = {
        TableName: tableName,
        Key: {
            'PK': school,
            'SK': act_id,
        },

        UpdateExpression: "SET ",

        ExpressionAttributeNames: {

        },

        ExpressionAttributeValues: {

        },

        ReturnValues : "ALL_NEW"
    };

    let UpdateExpressionLogic = [];

    // if parameter act_data is passes, update it
    if(act_data != undefined){
        UpdateExpressionLogic.push("#act_data = :actData");

        recordUpdateCommand.ExpressionAttributeNames["#act_data"] = "act_data";
        recordUpdateCommand.ExpressionAttributeValues[":actData"] = act_data;
    }


    // if parameter tch_email is passes, update it
    if(tch_email != undefined){

        // if name don't get provided
        if(tch_name == undefined){
            return ({
                "statusCode": 400,
                "body": "tch_name is undefine",
                "headers" : headers
            });
        }

        UpdateExpressionLogic.push("#GSI2PK = :tchEmail");
        UpdateExpressionLogic.push("#tch_name = :tchName");

        recordUpdateCommand.ExpressionAttributeNames["#GSI2PK"] = "GSI2PK";
        recordUpdateCommand.ExpressionAttributeNames["#tch_name"] = "tch_name";
        
        recordUpdateCommand.ExpressionAttributeValues[":tchEmail"] = tch_email;
        recordUpdateCommand.ExpressionAttributeValues[":tchName"] = tch_name;
    }



    let change = [0,0,0,0];
    let updateStatistic;
    let returnBody;

    if(flag != undefined && flag != old_flag){

        UpdateExpressionLogic.push("#GSISK = :gsisk");

        recordUpdateCommand.ExpressionAttributeNames["#GSISK"] = "GSISK";
        recordUpdateCommand.ExpressionAttributeValues[":gsisk"] = act_type + "_" + flag; 

        //increase the type that got add by act_done_time
        change[typeDetect[flag]] = act_done_time;

        //decrease the type that got delete by act_done_time
        change[typeDetect[old_flag]] = -act_done_time;


        updateStatistic = {
            TableName: tableName,
            Key: {
                "PK" : school,
                "SK" : std_SK
            },

            UpdateExpression: "SET #h[0] = #h[0] + :v0, #h[1] = #h[1] + :v1, #h[2] = #h[2] + :v2, #h[3] = #h[3] + :v3",
            ExpressionAttributeNames: {
                "#h": "stat_" + act_type 
            },
            ExpressionAttributeValues: {
                ":v0" : change[0],
                ":v1" : change[1],
                ":v2" : change[2],
                ":v3" : change[3] 
            }
        }

    }

    // At least 1 updeatExpression need to be present
    if(UpdateExpressionLogic.length > 0){

        UpdateExpressionLogic.push("#act_update = :actUpdate");

        recordUpdateCommand.ExpressionAttributeNames["#act_update"] = "act_update";
        recordUpdateCommand.ExpressionAttributeValues[":actUpdate"] = new Date().toISOString();

        recordUpdateCommand.UpdateExpression += UpdateExpressionLogic[0];

        for(let i = 1;i < UpdateExpressionLogic.length;i++){
            recordUpdateCommand.UpdateExpression += "," + UpdateExpressionLogic[i];
        }

        try{

            const recordPutResponse = await client.send(new UpdateCommand(recordUpdateCommand));

            returnBody = outputTransform([recordPutResponse.Attributes]);
            
        }catch (error){
            return ({
                "statusCode": 400,
                "body": "Update record unsuccessful : " + error,
                "headers" : headers
            });
        }

        if(updateStatistic != undefined){
            try{
                const updateStatisticResponse = await client.send(new UpdateCommand(updateStatistic));

            }catch (error){

                return ({
                    "statusCode": 400,
                    "body": "Update record is OK, but update statistic is unsuccessful : " + error,
                    "headers" : headers
                });

            }
        }

    }else{

        // Nothing to update
        return ({
            "statusCode": 200,
            "body": "Nothing to update",
            "headers" : headers
        });
    }

    return ({
        "statusCode": 200,
        "body": JSON.stringify(returnBody),
        "headers" : headers
    });

};

