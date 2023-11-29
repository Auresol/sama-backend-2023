import client from './samaDBConnect.mjs';
import outputTransform from './miscellaneous.mjs';
import { QueryCommand,PutCommand,UpdateCommand } from "@aws-sdk/lib-dynamodb";

const all_act_struct = {

    "01" : {
        act_name : "การบำเพ็ญประโยชน์ต่อสังคม",
        act_unit : "ชั่วโมง",
        max : 15
    },
    "02" : {
        act_name : "การบำเพ็ญประโยชน์ต่อโรงเรียน",
        act_unit : "ชั่วโมง",
        max : 10
    },
    
    "03" : {
        act_name : "การอ่านหนังสือ",
        act_unit : "เล่ม",
        max : 5
    },
    "04" : {
        act_name : "การเข้าค่ายวิชาการ",
        act_unit : "ครั้ง",
        max : 1,
        priority : -1
    },
    "05" : {
        act_name : "การเข้าค่ายปฎิบัติธรรม",
        act_unit : "ครั้ง",
        max : 1,
        priority : -1
    },
    "06" : {
        act_name : "การศึกษาดูงานด้านคณิตศาสตร์ วิทยศาสตร์และเทคโนโลยี",
        act_unit : "ครั้ง",
        max : 1,
        priority : -1
    },
    "07" : {

        act_name : "การศึกษาดูงานด้านสังคมศึกษา ภาษา ศาสนา ศิลปวัฒนธรรมและโบราณคดี",
        act_unit : "ครั้ง",
        max : 1,
        priority : -1
    },
    "08" : {
        act_name : "การฟังบรรยายด้านวิทยศาสตร์และเทคโนโลยี",
        act_unit : "ครั้ง",
        max : 1,
        priority : -1
    },
    "09" : {
        act_name : "การฟังบรรยายด้านพัฒนาบุคลิกภาพและความฉลาดทางอารมณ์",
        act_unit : "ครั้ง",
        max : 1,
        priority : -1
    },
    "10" : {
        act_name : "การฟังบรรยายด้านสังคมศึกษา ศาสนา ศิลปวัฒนธรรมและดนตรี",
        act_unit : "ครั้ง",
        max : 1,
        priority : -1
    },
    "11" : {
        act_name : "การเข้าร่วมกิจกรรมชุมนุม",
        act_unit : "ครั้ง",
        max : 1
    },
    "12" : {
        act_name : "การออกกำลังกายและการเล่นกีฬา",
        act_unit : "ครั้ง",
        max : 40
    },
    "13" : {
        act_name : "การเข้าร่วมกิจกรรมพบพ่อครู/แม่ครู",
        act_unit : "ครั้ง",
        max : 90
    }

};

export const lambdaHandler = async (event, context) => {

    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    };

    try{

        const tableName = process.env.ACT_TABLE;
        
        const requestPath = event.pathParameters;    
        const requestBody = JSON.parse(event.body);

        const school = requestPath.school;                  //Require
        const std_email = requestPath.email;                //Require

        const act_type = requestBody.act_type;              //Require
        const act_data = requestBody.act_data;              //Require
        const act_done_time = requestBody.act_done_time;    //Require

        //console.info(school + " , " + std_email + " , " + std_SK + " , " + act_type + " , " + JSON.stringify(act_data));

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
                "body": "qeury error : " + error,
                "headers" : headers
            });            
        }

        /*
        if(getDataResponse.Count != 1){

            return ({
                "statusCode": 400,
                "body": "This email don't exist",
                "headers" : headers
            });

        }
        */

        console.info("EXTRACT DATA");

        const std_SK = getDataResponse.Items[0].SK;
        const std_id = getDataResponse.Items[0].id;
        const std_number = getDataResponse.Items[0].number;

        const std_sk_split = std_SK.split("_");
        const name = std_sk_split[2].split(".");

        const std_firstname = name[0];
        const std_lastname = name[1];
        const std_classroom = std_sk_split[1];

        const act_stat = getDataResponse.Items[0]["stat_" + act_type];

        //console.info(std_SK + ", " + std_id + ", " + std_number + ", " + std_firstname + ", " + std_lastname + ", " + std_classroom);       

        if(act_stat.reduce((a, b) => a + b, 0) >= all_act_struct[act_type].max){

            return ({
                "statusCode": 200,
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

        console.info(recordPutCommand);

        const updateStatistic = {

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

            returnBody = outputTransform([recordPutCommand.Item]);

        }catch (error){
            return ({
                "statusCode": 400,
                "body": "create new record error : " + error,
                "headers" : headers
            });
        }

        try{

            const updateStatisticResponse = await client.send(new UpdateCommand(updateStatistic));

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
    

    }catch (error){

        return ({
            "statusCode": 400,
            "body": "Error : " + error,
            "headers" : headers
        });
    
    }

};

