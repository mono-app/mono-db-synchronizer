require('module-alias/register');
require('dotenv').config();

const admin = require("firebase-admin");
const uuid = require("uuid/v4");
const serviceAccount = require("@keys/serviceAccountKey.json");
const { Pool } = require("pg");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://chat-app-fdf76.firebaseio.com",
});

(async () => {
  const db = admin.firestore();
  const usersRef = db.collection("users");
  const querySnapshot = await usersRef.get();

  const pool = new Pool();
  const client = await pool.connect();

  try{
    await client.query("BEGIN");

    const users = (await Promise.all(querySnapshot.docs.map(async (docSnapshot) => {
      const userData = docSnapshot.data();
      userData.email = docSnapshot.id;
      try{
        userData.id = (await admin.auth().getUserByEmail(userData.email)).uid;
        if(userData.isCompleteSetup){
          userData.birthday = (userData.personalInformation.birthday)? userData.personalInformation.birthday: null;
        }else userData.birthday = null;
        return userData;
      }catch(err){ 
        console.log(err, userData.email);
        return Promise.resolve(null); 
      }
    }))).filter((user) => user !== null);

    await Promise.all(users.map(async (user) => {
      try{;
        await client.query(
          "INSERT INTO users(id, email, is_complete_setup, is_login, server_created_at, last_modified_at) VALUES ($1, $2, $3, $4, NOW(), NOW())",
          [ user.id, user.email, user.isCompleteSetup, user.isLogin ]
        );

        if(user.isCompleteSetup){
          const application_information_id = uuid();
          const personal_information_id = uuid();
          const phone_number_id = uuid();
          
          await client.query(
            "INSERT INTO application_informations(id, mono_id, nick_name, user_id, server_created_at, last_modified_at) VALUES ($1, $2, $3, $4, NOW(), NOW())",
            [ uuid(), user.applicationInformation.id, user.applicationInformation.nickName, user.id ]
          );

          await client.query(
            "UPDATE users SET application_information_id=$1 WHERE id=$2",
            [ application_information_id, user. id ]
          )

          await client.query(
            "INSERT INTO personal_informations(id, family_name, given_name, gender, birthday, user_id, server_created_at, last_modified_at) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())",
            [ uuid(), user.personalInformation.familyName, user.personalInformation.givenName, user.personalInformation.gender, user.birthday, user. id ]
          )

          await client.query(
            "UPDATE users SET personal_information_id=$1 WHERE id=$2",
            [ personal_information_id, user. id ]
          )

          await client.query(
            "INSERT INTO phone_numbers(id, is_verified, number, user_id, server_created_at, last_modified_at) VALUES ($1, $2, $3, $4, NOW(), NOW())",
            [ uuid(), user.phoneNumber.isVerified, user.phoneNumber.value, user.id ]
          )

          await client.query(
            "UPDATE users SET phone_number_id=$1 WHERE id=$2",
            [ phone_number_id, user. id ]
          )

          if(user.applicationInformation.profilePicture){
            const profile_picture_id = uuid();
            await client.query(
              "INSERT INTO profile_pictures(id, download_url, storage_path, user_id, server_created_at, last_modified_at) VALUES ($1, $2, $3, $4, NOW(), NOW())",
              [ uuid(), user.applicationInformation.profilePicture.downloadUrl, user.applicationInformation.profilePicture.storagePath, user.id ]
            )

            await client.query(
              "UPDATE users SET profile_picture_id=$1 WHERE id=$2",
              [ profile_picture_id, user. id ]
            )
          }
        }

      }catch(err){ 
        console.log(err, user.id);
        return Promise.reject(err);
      }
    }))

    await client.query("COMMIT");
  }catch(err){
    await client.query("ROLLBACK");
    throw err
  }finally{
    client.release();
    pool.end();
    console.log("Completed");
  }

})().catch(err => console.error(err.stack));