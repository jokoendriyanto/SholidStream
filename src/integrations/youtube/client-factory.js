'use strict';
const {google}=require('googleapis');
class YoutubeClientFactory{
 constructor({clientId,clientSecret,redirectUri,connectionRepository,OAuth2Class=google.auth.OAuth2,googleApi=google}={}){if(!clientId||!clientSecret||!redirectUri||!connectionRepository)throw new TypeError('YoutubeClientFactory dependencies are required');Object.assign(this,{clientId,clientSecret,redirectUri,connectionRepository,OAuth2Class,googleApi});}
 async forConnection(workspaceId,connectionId){const connection=await this.connectionRepository.findDecrypted(workspaceId,connectionId);if(!connection)throw Object.assign(new Error('YouTube connection not found'),{code:'YOUTUBE_CONNECTION_NOT_FOUND'});const oauth=new this.OAuth2Class(this.clientId,this.clientSecret,this.redirectUri);oauth.setCredentials(connection.credentials);oauth.on?.('tokens',async(tokens)=>{const merged={...connection.credentials,...tokens};await this.connectionRepository.updateCredentials(workspaceId,connectionId,merged).catch(()=>{});});return{youtube:this.googleApi.youtube({version:'v3',auth:oauth}),connection};}
}
module.exports={YoutubeClientFactory};
