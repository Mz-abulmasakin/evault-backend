import {
  getMyWallet,
  creditWallet,
  debitWallet
} from "./wallet.service.js";



/**
 * Get logged-in user's wallet
 */
export async function getWallet(req, res){

  try{

    const userId = req.user.id;


    const wallet =
      await getMyWallet(userId);



    return res.status(200).json({

      success:true,

      data:wallet

    });


  }
  catch(error){

    return res.status(400).json({

      success:false,

      message:error.message

    });

  }

}







/**
 * Fund wallet
 *
 * Temporary endpoint for testing.
 * Later replaced by payment webhook.
 */
export async function fundWallet(req,res){

  try{


    const {
      walletId,
      amount,
      reference,
      description,
      metadata

    } = req.body;




    const result =
      await creditWallet({

        walletId,

        amount,

        reference,

        description,

        metadata

      });





    return res.status(200).json({

      success:true,

      message:"Wallet funded successfully",

      data:result

    });



  }
  catch(error){


    return res.status(400).json({

      success:false,

      message:error.message

    });


  }

}









/**
 * Debit wallet
 *
 * Used for:
 * Airtime
 * Data
 * CAC
 * TIN
 * Bills
 */
export async function spendWallet(req,res){

  try{


    const {

      walletId,

      amount,

      reference,

      description,

      metadata

    } = req.body;





    const result =
      await debitWallet({

        walletId,

        amount,

        reference,

        description,

        metadata

      });





    return res.status(200).json({

      success:true,

      message:"Payment successful",

      data:result

    });



  }
  catch(error){


    return res.status(400).json({

      success:false,

      message:error.message

    });


  }

}