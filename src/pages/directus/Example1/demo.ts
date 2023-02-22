// const query = `query {
//   jecn_flow_structure_h {
//      FLOW_ID
//   }
// }`;
// const query = `query {
//   jecn_flow_structure_h(filter : {
//     FLOW_NAME: {_contains: "管理"}
//   }){
//     FLOW_ID,
//     FLOW_NAME
//   }
// }`;
// const query = `query {
//   jecn_flow_structure_h(search:"管理"){
//     FLOW_NAME
//   }
// }`;
// const query = `query {
//   jecn_flow_structure_h(page:1,limit:30){
//     FLOW_NAME
//   }
// }`;

// const query = `query {
//   jecn_flow_structure_h(filter{
//     _and:[
//       FLOW_NAME: {_contains: "管理"},
//     ]
//   }){
//     FLOW_ID,
//     FLOW_NAME
//   }
// }`; // not work

// const result = await directus.graphql.items(query);
// console.log("result", result);

// await directus.graphql.system(`mutation {
//   auth_login(email: "admin@jecn.com", password: "jecn@123") {
//     access_token
//   }
// }`);

export {};
