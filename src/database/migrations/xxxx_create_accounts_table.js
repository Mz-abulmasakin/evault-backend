export const shorthands = undefined;


export async function up(pgm) {

  pgm.createTable("accounts", {

    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },


    user_id:{
      type:"uuid",
      notNull:true,
      references:"users",
      onDelete:"CASCADE",
      unique:true,
    },


    account_number:{
      type:"varchar(20)",
      notNull:true,
      unique:true,
    },


    account_name:{
      type:"varchar(150)",
      notNull:true,
    },


    balance:{
      type:"decimal(15,2)",
      notNull:true,
      default:0,
    },


    currency:{
      type:"varchar(5)",
      notNull:true,
      default:"NGN",
    },


    status:{
      type:"varchar(20)",
      notNull:true,
      default:"ACTIVE",
    },


    created_at:{
      type:"timestamp with time zone",
      notNull:true,
      default:pgm.func("CURRENT_TIMESTAMP"),
    },


    updated_at:{
      type:"timestamp with time zone",
      notNull:true,
      default:pgm.func("CURRENT_TIMESTAMP"),
    }

  });

}



export async function down(pgm){

 pgm.dropTable("accounts");

}