import {
getMyAccount
}
from "./account.service.js";


export async function getAccount(req,res){

try{


const account =
await getMyAccount(
req.user.id
);


res.json({

success:true,

account

});


}catch(error){


res.status(404)
.json({

success:false,

message:error.message

});


}

}