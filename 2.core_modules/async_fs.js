const { error } = require("console");
const fs = require("fs");

//writr file

// const a = fs.writeFile("test.txt","tamil",
//     (error) => {
//         if(error) throw error;
//         console.log("completed");
//     }
// );
// console.log("Processing");

///Read file

const a = fs.writeFile("Asynchronous.txt","Bharath",
    (error) => {
        if(error) throw error;
        console.log("completed");

        //read

        fs.readFile("Asynchronous.txt",{encoding:"utf-8"},(err,data)=>{
       console.log("Read file",data);
        })

       
    }
);
console.log("Processing");
