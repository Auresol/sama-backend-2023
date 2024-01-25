const GLOBAL_KEY_MAPPER = {
    "GSI1PK" : "std_email",
    "GSI2PK" : "tch_email",
    "PK" : "school"
}

const SK_KEY_MAPPER = {
    "STD" : "std_SK",
    "TCH" : "tch_SK",
    "ADMIN" : "admin_SK",
    "REC" : "act_id"
}

//output -> list
//out_type -> STD TCH ADMIN REC
function outputTransform(output){
    
    for(const itemPos in output){

        // item is JSON
        let item = output[itemPos];

        if(item == {} || item == null){
            delete output[itemPos];
            continue;
        }
    
        const sk_split = item["SK"].split("_");
        const out_type = sk_split[0];
        item["type"] = sk_split[0];
    
        // Delete or replace the SK key
        if(out_type == "REC"){
            
            const gsisk_split = item["GSISK"].split("_");
            item["act_type"] = gsisk_split[0];
            item["flag"] = gsisk_split[1];
    
            item["std_email"] = sk_split[2];
    
        }else if(out_type == "STD"){
    
            item["std_classroom"] = sk_split[1];

            if("number" in item){
                item["std_number"] = item["number"];
                delete item["number"];
            }
    
            const name = sk_split[2].split(".");
            item["std_firstname"] = name[0];
            item["std_lastname"] = name[1];
    
        }else if(out_type == "TCH"){

            item["tch_classroom"] = sk_split[1];
            
            const name = sk_split[2].split(".");
            item["tch_firstname"] = name[0];
            item["tch_lastname"] = name[1];
        }
    
        // Replace the SK key
        const newKey = SK_KEY_MAPPER[out_type];
        item[newKey] = item["SK"];
    
        delete item["SK"];
        delete item["GSISK"];
    
        for(let key in item){
    
            if(key in GLOBAL_KEY_MAPPER){
    
                const newKey = GLOBAL_KEY_MAPPER[key];
    
                item[newKey] = item[key];
    
                delete item[key];
    
            }
    
        }
    }

    return output
}

export default outputTransform;