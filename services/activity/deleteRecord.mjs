import client from './samaDBConnect.mjs';
import { DeleteCommand, GetCommand ,UpdateCommand, QueryCommand} from "@aws-sdk/lib-dynamodb";


export const lambdaHandler = async (event, context) => {

    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    };

    try{
        const tableName = process.env.ACT_TABLE;

        const requestPath = event.pathParameters;    

        const school = requestPath.school;                  //Require
        const act_id = requestPath.act_id;                  //Require

        const typeDetect = {
            "PENDING" : "0",   
            "SEND" : "1",  
            "ACCEPT" : "2",    
            "REJECT" : "3"     
        }

        //Query to see the flag
        const recordFlagGet = new GetCommand({
            TableName: tableName,
            Key : {
                "PK" : school,
                "SK" : act_id
            },
        });

        const recordGetResponse = await client.send(recordFlagGet);
        
        const GSISK = recordGetResponse.Item.GSISK.split("_");
        const act_done_time = recordGetResponse.Item.act_done_time;
        const act_type = GSISK[0];
        const flag = GSISK[1];


        // extract email from act_id
        const email = act_id.split("_")[2];

        // query to see the std_SK
        const stdDataQueryCommand = new QueryCommand({
            TableName: tableName,
            IndexName: "GSI1",
            KeyConditionExpression: "GSI1PK = :email AND GSISK = :datas",
            ExpressionAttributeValues: {
                ":email" : email,
                ":datas" : "DATA"
            },

            ProjectionExpression: "SK"

        });

        // get the std_SK
        const std_SK = (await client.send(stdDataQueryCommand)).Items[0].SK;


        //Delete record from student
        const recordDelete = {
            TableName: tableName,
            Key : {
                "PK" : school,
                "SK" : act_id
            }
        };

        //Update the statistic for that type and flag
        const updateStatistic = {
            TableName: tableName,
            Key: {
                "PK" : school,
                "SK" : std_SK
            },

            UpdateExpression: "SET #h[" + typeDetect[flag] + "] = #h[" + typeDetect[flag] + "] + :v",
            ExpressionAttributeNames: {
                "#h": "stat_" + act_type 
            },

            ExpressionAttributeValues: {
                ":v" : -act_done_time
            }

        }

        try{
            const recDeleteResponse = await client.send(new DeleteCommand(recordDelete));

        }catch (error){
            return ({
                "statusCode": 400,
                "body": "Delete record unsuccessful : " + error,
                "headers" : headers
            });
        }

        const updateStatisticResponse = await client.send(new UpdateCommand(updateStatistic));

        return ({
            "statusCode": 200,
            "body": "Delete record successfully",
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



