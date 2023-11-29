import client from './samaDBConnect.mjs';
import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

export const lambdaHandler = async (event, context) => {

    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    };

    try{

        const tableName = process.env.ACT_TABLE;

        const requestPath = event.pathParameters;
        const requestQueryString = event.queryStringParameters;


        const email = requestPath.email;                        //Require

        let act_type;
        let flag;
        let type;

        try{

            type = requestQueryString.type;
            act_type = requestQueryString.act_type;             //Optional
            flag = requestQueryString.flag;                     //Optional

        }catch{

            act_type = undefined;
            flag = undefined;

        }

        const IndexNum = (type == "STD"?"GSI1":"GSI2");
        const GSIPKnumber = IndexNum + "PK";

        let multipleQueryRequest = []

        //Don't specify a type --> all type --> use begins_with()
        if(act_type == undefined){

            //if flag is provided, query base on flag
            multipleQueryRequest.push({
                TableName: tableName,
                IndexName: IndexNum,
                KeyConditionExpression: GSIPKnumber + " = :partitionKey AND begins_with(GSISK, :prefix)",
                ExpressionAttributeValues: {
                    ':partitionKey': email,
                    ':prefix' : "REC"
                }
            
            });

            

            //if flag does not provided, query everything



        }else{


            // Section 2 Specify a type

            // if flag is not provide, all flag would be use
            if(flag == undefined){
                flag = ["PENDING","SEND","ACCEPT","REJECT"];
            }


            // Create a loop for generate all possible query

            for(const actTypeItem in act_type){
                for(const flagItem in flag){

                    const prefix = actTypeItem + "_" + flagItem;
                    
                    multipleQueryRequest.push({
                        TableName: tableName,
                        IndexName: IndexNum,
                        KeyConditionExpression: GSIPKnumber + " = :partitionKey",
                        ExpressionAttributeValues: {
                            ':partitionKey': email,
                        }
                    });

                }
            }
            

        }

        let response = []
        for(let i = 0;i < multipleQueryRequest.length;i++){
            
            try{

                response.push(await client.send(new QueryCommand(multipleQueryRequest[i])));

            }catch (error){
                return ({
                    "statusCode": 400,
                    "body": "Multiple query errer : " + error,
                    "headers" : headers
                });
            }

        }

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



