import nodemailer from "nodemailer"
const sendEmail = async ( email ,htmlMessage) => {

    try {
        // Logic to send the email using the provided email address
        // Example using nodemailer to send the email
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {     
              user: process.env.USER_EMAIL,
              pass: process.env.USER_PASS,
            },
          });
       
      
          const mailOptions = {
            from: process.env.USER_EMAIL,
            to: email,
            subject: 'Cleaning Staff  Details ',
            html:htmlMessage
          };
    
          await transporter.sendMail(mailOptions);
          if(mailOptions){
            console.log("Email send successfully");     
        }else{
            console.log("Email not send successfully");     

        }
    } catch (error) {
        console.error(error);
        throw new Error('Failed to send email');
    }
};

export default sendEmail;
