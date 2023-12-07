import client from './samaDBConnect.mjs';
import outputTransform from './miscellaneous.mjs';
import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

export const lambdaHandler = async (event, context) => {

    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    };


    const tableName = process.env.ACT_TABLE;

    const requestPath = event.pathParameters;
    const requestQueryString = event.queryStringParameters;

    const email = requestPath.email;                        //Require

    let act_type;
    let flag;

    try{
        act_type = requestQueryString.act_type;             //Optional
    }catch{
        act_type = undefined;
    }
    try{
        flag = requestQueryString.flag;                     //Optional
    }catch{
        flag = undefined;
    }

    // Query to see if this email a student or a teacher
    let getDataCommand = {
        TableName: tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :email AND GSISK = :datas",
        ExpressionAttributeValues: {
            ":email" : email,
            ":datas" : "DATA"
        },

    };

    let type = "STD";
    let getDataResponse = await client.send(new QueryCommand(getDataCommand));
    
    if(getDataResponse.Count == 0){

        type = "TCH";

        getDataCommand.IndexName = "GSI2";
        getDataCommand.KeyConditionExpression = "GSI2PK = :email AND GSISK = :datas",
        
        getDataResponse = await client.send(new QueryCommand(getDataCommand));

        if(getDataResponse.Count == 0){

            return ({
                "statusCode": 400,
                "body": "Email not found",
                "headers" : headers
            });

        }

    }

    const IndexNum = (type == "STD"?"GSI1":"GSI2");
    const GSIPKnumber = IndexNum + "PK";

    let request;
    let multiRequest = [];

    //Don't specify a type --> all type --> use begins_with()
    if(act_type == undefined){

        
        if(flag != undefined){

            for(let i = 1;i <= 13;i++){

                const typenum = (i < 10? "0":"") + parseInt(i);

                multiRequest.push({
                    TableName: tableName,
                    IndexName: IndexNum,
                    KeyConditionExpression: GSIPKnumber + " = :partitionKey AND GSISK = :gsisk",
                    ExpressionAttributeValues: {
                        ':partitionKey': email,
                        ':gsisk' : typenum + "_" + flag
                    }                    
                });
            }

        }else{

            request = {
                TableName: tableName,
                IndexName: IndexNum,
                KeyConditionExpression: GSIPKnumber + " = :partitionKey",
                ExpressionAttributeValues: {
                    ':partitionKey': email,
                },

                ScanIndexForward: false
            
            };
        }

        
        //if flag does not provided, query everything

    }else{


        // Section 2 Specify a type
        const prefix = act_type + (flag == undefined? "":"_" + flag);
        
        //query everything in GSI (DATA also)
        request = {
            TableName: tableName,
            IndexName: IndexNum,
            KeyConditionExpression: GSIPKnumber + " = :partitionKey AND begins_with(GSISK, :prefix)",
            ExpressionAttributeValues: {
                ':partitionKey': email,
                ':prefix' : prefix
            },

            ScanIndexForward: false
        };
        

    }

    let response;
    let returnBody;

    try{

        if(request != undefined){

            response = await client.send(new QueryCommand(request));
            response.Items = response.Items.filter(function(item){
                return item.GSISK !== "DATA" ;
            });

            returnBody = outputTransform(response.Items);

        }else{

            response = [];

            for(const itemPos in multiRequest){

                const tempRes = await client.send(new QueryCommand(multiRequest[itemPos]));

                if(tempRes.Count > 0){
                    response = response.concat(tempRes.Items);
                }
            }

            returnBody = outputTransform(response);

        }

    }catch (error){
        return ({
            "statusCode": 200,
            "body": "Error querying : " + error,
            "headers" : headers
        });
    }

    return ({
        "statusCode": 200,
        "body": JSON.stringify(returnBody),
        "headers" : headers
    });
        
};



