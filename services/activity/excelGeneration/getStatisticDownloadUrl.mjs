import client from './samaDBConnect.mjs';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import { S3Client, GetObjectCommand, PutObjectCommand  } from "@aws-sdk/client-s3";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { error } from 'console';

const ExcelJS = require('exceljs');

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
        const region = process.env.REGION;
        const samaDataBucket = process.env.SAMA_DATA_BUCKET;

        const requestPath = event.pathParameters;
        const requestQueryString = event.queryStringParameters;     

        const school = requestPath.school;                  //Require

        let stat_type;                                           //Require

        try{
            stat_type = requestQueryString.type;
            
        }catch{

            stat_type = "ALL";

        }

        const getStaticListCommand = {
            
            TableName: tableName,
            KeyConditionExpression: "PK = :school AND begins_with(SK, :type)",
            ExpressionAttributeValues: {
                ":school" : school,
                ":type" : "STD"
            },

        };


        const getStaticListResponse = await client.send(new QueryCommand(getStaticListCommand));

        // create a workbook
        const workbook = excelGeneration(stat_type, getStaticListResponse.Items);

        // Save the Excel file to a buffer
        const buffer = await workbook.xlsx.writeBuffer();

        // Upload the Excel file to S3
        const s3Client = new S3Client({ region : region });

        let uploadKey = 'statistic_excel/' + school + '/stat_ALL.xlsx';
        
        if(stat_type != "ALL"){
            uploadKey = 'statistic_excel/' + school + '/stat_' + stat_type.replace("/",".") + '.xlsx';
        }

        try {
            
            const putExcelCommand = new PutObjectCommand({

                Bucket : samaDataBucket,
                Key : uploadKey,
                Body : buffer 
                
            });

            const putExcelResponse = await s3Client.send(putExcelCommand);

        } catch (error) {

            return ({
                "statusCode": 400,
                "body": "Upload uncsuccessful : " + error,
                "headers" : headers
            });

        }

        const clientUrl = await createPresignedUrlWithClient({
            client: s3Client,
            bucket: samaDataBucket,
            key: uploadKey,
        });

        return ({
            "statusCode": 200,
            "body": JSON.stringify({ status : "Success", url : clientUrl}),
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

const createPresignedUrlWithClient = ({ client, bucket, key }) => {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    return getSignedUrl(client, command, { expiresIn: 3600 });
};

function excelGeneration(stat_type, raw_data){

    const workbook = new ExcelJS.Workbook();

    const columnProperties = columnsGeneration();

    const stat_data = dataClassifier(raw_data);
    
    if(stat_type == "ALL"){

        for(const year in stat_data){
            pageCreater(workbook, columnProperties, stat_data[year], year);
        }

    }else{

        const stat_type_split = stat_type.split("/");
        const classyear = stat_type_split[0];
        const classroom = stat_type_split[1];

        if(stat_data[classyear][classroom] == undefined){
            throw "Not a single human begin present here";
        }

        const temp = {};
        temp[classroom] = stat_data[classyear][classroom];
        
        pageCreater(workbook, columnProperties, temp, classyear);

    }

    return workbook;

}

function dataClassifier(raw_data){

    let classify_data = {};
    let stat_unfinish = {};

    for(const i in raw_data){

        const person = raw_data[i];

        let new_person = {}

        const sk_split = person.SK.split("_");
        const class_split = sk_split[1].split("/");

        const classyear = class_split[0];
        const classroom = class_split[1];

        new_person["id"] = person.id;
        new_person["names"] = sk_split[2].replace("."," ");
        new_person["number"] = person.number;


        if(classify_data[classyear] == undefined){
            classify_data[classyear] = {};
            stat_unfinish[classyear] = {};

        }
        
        if(classify_data[classyear][classroom] == undefined){
            classify_data[classyear][classroom] = { "data" : [], "stat" : {} }; 
            stat_unfinish[classyear][classroom] = {};

        }

        for(const statwise in person){

            if(statwise.startsWith("stat")){
                
                // act_id_temp = xx 
                const act_id_temp = statwise.split("_")[1];

                // ACCEPT only
                new_person[act_id_temp] = person[statwise][2];

                if(new_person[act_id_temp] < all_act_struct[act_id_temp].max){

                    if(stat_unfinish[classyear][classroom][act_id_temp] == undefined){
                        stat_unfinish[classyear][classroom][act_id_temp] = 1;

                    }else{
                        stat_unfinish[classyear][classroom][act_id_temp] += 1;

                    }

                }

            }

        }

        classify_data[classyear][classroom]["data"].push(new_person); 
    }

    for(const year in classify_data){
        for(const room in classify_data[year]){

            classify_data[year][room]["data"].sort(function(a,b){
                return a.number - b.number;
            });

            let stat_summary = {
                "names" : "สรุป " + year + "/" + room
            };

            const std_amount = classify_data[year][room]["data"].length;
            
            for(const key in all_act_struct){
                if(key in stat_unfinish[year][room]){

                    stat_summary[key] = (std_amount - stat_unfinish[year][room][key])/std_amount;
                }else{

                    stat_summary[key] = 1;
                }
            }

            classify_data[year][room]["stat"] = stat_summary;

        }
    }   

    
    return classify_data;
};

function columnsGeneration(){

    let columnProperties = [
        {
            'header' : "ชื่อ",
            'key' : 'names',
            'width' : 20
        },
        {
            'header' : "รหัสประจำตัว",
            'key' : 'id',
            'width' : 20
        },
        {
            'header' : "เลขที่",
            'key' : 'number',
            'width' : 20
        }
    ];

    const lowPriorityColumnProperties = [];

    for(const actNum in all_act_struct){

        const act = all_act_struct[actNum];

        if("priority" in act && act.priority == -1){

            lowPriorityColumnProperties.push({
                'header' : act.act_name + " ( /" + act.max + " " + act.act_unit + ")",
                'key' : actNum,
                'width' : 20,
                'height' : 30
            })

        }else{

            columnProperties.push({
                'header' : act.act_name + " ( /" + act.max + " " + act.act_unit + ")",
                'key' : actNum,
                'width' : 20,
                'height' : 30
            })

        }
    }

    columnProperties = columnProperties.concat(lowPriorityColumnProperties);

    return columnProperties;

}


function pageCreater(workbook, columnsProperties, std_data, year){

    const worksheetProperties = {
        views : [
            {
                state: 'frozen', 
                xSplit: 1,
                ySplit: 1
            }
        ]
    };

    const classShiftBorder = {
        top: {style:'thin'},
        bottom: {style:'thin'},
    };

    const worksheet = workbook.addWorksheet('ม.' + year, worksheetProperties);
    worksheet.columns = columnsProperties;
    const toprow = worksheet.getRow(1);
    toprow.height = 40;
    toprow.alignment = { 
        vertical: 'middle', 
        horizontal: 'center',
        wrapText: true 
    };

    toprow.border = {
        bottom: {style:'double'},
    }

    for(const room in std_data){

        const header_row = worksheet.addRow({ "names" : year + "/" + room });
        header_row.border = classShiftBorder;
        header_row.height = 25;

        for(const personPos in std_data[room]["data"]){

            const person = std_data[room]["data"][personPos];

            const newRow = worksheet.addRow(person);

            for(const key in person){

                if(key in all_act_struct && person[key] < all_act_struct[key]["max"]){

                    newRow.getCell(key).fill = {
                        type: 'pattern',
                        pattern:'solid',
                        fgColor: { argb:'F0FF87' }
                    };

                }

            }
        }

        const stat_row_temp = std_data[room]["stat"]
        const stat_row = worksheet.addRow(stat_row_temp);

        stat_row.fill = {
            type: 'pattern',
            pattern:'solid',
            fgColor: { argb: 'CCFFCC' }
        }

        for(const key in stat_row_temp){

            if(key != "names" && stat_row_temp[key] < 1){

                stat_row.getCell(key).fill = {
                    type: 'pattern',
                    pattern:'solid',
                    fgColor: { argb:'FFFF99' }
                };


            }
        }

        stat_row.numFmt = '0.00%';
        stat_row.border = classShiftBorder;

        worksheet.addRow({});

    }

}




