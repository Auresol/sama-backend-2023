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

    let classroom;
    try{
        classroom = requestQueryString.classroom;

    }catch{
        classroom = undefined;
        
    }


    /*
    // type not specific, query for all type
    if(type.lenght == 0){
        type = ["STD","TCH","ADMIN"];
    }

    // classroom not specific, query for all classroom
    if(classroom.lenght == 0){

        let command = {
        
            TableName: tableName,
            KeyConditionExpression: "PK = :school AND begins_with(SK, :type)",
            ExpressionAttributeValues: {
                ":school" : school,
                ":type" : type[0],
            },
    
        };

    }
    */

    const command = {
        
        TableName: tableName,
        KeyConditionExpression: "PK = :school AND begins_with(SK, :type)",
        ExpressionAttributeValues: {
            ":school" : school,
            ":type" : "STD" + (classroom == undefined? "":"_" + classroom)     
        },

    };

    let response;

    try{
        response = await client.send(new QueryCommand(command));

    }catch (error){

        return ({
            "statusCode": 200,
            "body": "Error querying : " + error,
            "headers" : headers
        });
    }



    let onlyStatistic = {};

    for(const itemPos in response.Items){
        let item = response.Items[itemPos];

        let newStat = {};

        for(const key in item){
            if(key.startsWith("stat")){
                newStat[key] = item[key];
            }
        }

        onlyStatistic["stat_" + item.GSI1PK] = newStat;
        
    }

    return ({
        "statusCode": 200,
        "body": JSON.stringify(onlyStatistic),
        "headers" : headers
    });
    
            
        
};



