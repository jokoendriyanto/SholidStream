'use strict';
const {google}=require('googleapis');
class YoutubeOAuthService{
 constructor({clientId,clientSecret,redirectUri,OAuth2Class=google.auth.OAuth2}={}){if(!clientId||!clientSecret||!redirectUri)throw new TypeError('YouTube OAuth client configuration is required');this.client=new OAuth2Class(clientId,clientSecret,redirectUri);}
 authorizationUrl({state,scopes=[]}){return this.client.generateAuthUrl({access_type:'offline',include_granted_scopes:true,prompt:'consent',state,scope:scopes});}
 async exchangeCode(code){if(!code)throw new TypeError('OAuth authorization code is required');const response=await this.client.getToken(code);return response.tokens||response;}
}
module.exports={YoutubeOAuthService};
