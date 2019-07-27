import {withData} from 'next-apollo';
import {HttpLink} from 'apollo-link-http';
import {WebSocketLink} from 'apollo-link-ws';
import {split} from 'apollo-client-preset';
import {getMainDefinition} from 'apollo-utilities';



export default withData(headers => {
  const GE_URL="https://data.condense57.hasura-app.io/v1alpha1/graphql";
  const GE_URL_WS="wss://data.condense57.hasura-app.io/v1alpha1/graphql";
  console.log(GE_URL,GE_URL_WS)
  const httpLink = new HttpLink({
    uri: GE_URL,
    // this goes here directly (there's actually no "opts" config)
    credentials: 'same-origin',
    // resend the headers on the server side, to be truly isomorphic (makes authentication possible)
    headers: {
      'Authorization': `Bearer f3f938a9d6a7a2849f7193d4d74f4012f01110e28466d30b`,
      'X-Hasura-Role': 'admin'
    },
  });

  return {
    link: process.browser
      ? split(
        ({query}) => {
          const {kind, operation} = getMainDefinition(query);

          return 'OperationDefinition' === kind && 'subscription' === operation;
        },
        // that's all you need to make subscriptions work :)
        new WebSocketLink({
          uri: GE_URL_WS,
          options: {reconnect: true}
        }),
        httpLink
      )
      : httpLink
  };
});