const fs = require("fs");

//write data
// console.log(fs);
// // fs.writeFileSync("../1.intro/test.txt", "Venkatesn");
// fs.writeFileSync("test.txt", "Venkatesn");
// console.log("File Written");

// //read data 

const data =fs.readFileSync("test.txt",{encoding:"utf-8"});
console.log("read :", data);

// //Add content without deleting old
// const b= await fs.appendFile("test.txt", "\nBharath");
// console.log("Content appended",b);

// const c= await fs.appendFile("test.txt", "\nTamil");
// console.log("Content appended",c);

//    await fs.unlink("test.txt");
//     console.log("Deleted");

/*
const fs = require("fs").promises;

async function fileOperations() {
  try {
    await fs.writeFile("test.txt", "Hello Venki");
    const data = await fs.readFile("test.txt", "utf-8");
    console.log("Read:", data);

    await fs.appendFile("test.txt", "\nNew Line");
    console.log("Appended");

    await fs.unlink("test.txt");
    console.log("Deleted");
  } catch (err) {
    console.error(err);
  }
}

fileOperations();

*/





