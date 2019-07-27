import Link from 'next/link'
import fetch from 'isomorphic-unfetch'
import React from 'react'
import gql from 'graphql-tag'
import { Query, Mutation, Subscription } from "react-apollo";
import withData from '../config';
import Head from 'next/head';
import { Button,PageHeader,Tabs,Tab,Panel,Row,Col,Navbar,Table,Nav,NavDropdown } from 'react-bootstrap';
import Router from 'next/router'
import parse from 'date-fns/parse'
import distanceInWordsToNow from 'date-fns/distance_in_words_to_now'

const ADD_USER = gql`
mutation ($username: String!) {
  insert_user (
    objects: [{
      username: $username
    }]
  ) {
    returning {
      id
      username
    }
  }
}
`;

const LOGOUT_USER = gql`
  mutation delete_user($username: String!) {
    delete_user(where: { username: { _eq: $username } }) {
      affected_rows
    }
  }
`;

    

const emitOnlineEvent = `
  mutation update_user($username:String!){
    update_user (
      _set: {
        last_seen: "now()"
      }
      where: {
        username: {
          _eq: $username
        }
      }
    ) {
      affected_rows
    }
  }
`;

const fetchMessages = `
  query ($last_received_id: Int, $last_received_ts: timestamptz){
    message (
      order_by: {timestamp:asc}
      where: {
        _and: {
          id: {
            _neq: $last_received_id
          },
          timestamp: {
            _gte: $last_received_ts
          }
        }
      }
    ) {
      id
      text
      username
      timestamp
    }
  }
`;


const subscribeToNewMessages = gql`
  subscription {
    message ( order_by: {id:desc} limit: 1) {
      id
      username
      text
      timestamp
    } }
`;

const insertMessage = gql`
  mutation insert_message ($message: message_insert_input! ){
    insert_message (
      objects: [$message]
    ) {
      returning {
        id
        timestamp
        text
        username
      }
    }
  }
`;

const emitTypingEvent = gql`
  mutation ($username: String) {
    update_user (
      _set: {
        last_typed: "now()"
      }
      where: {
        username: {
          _eq: $username
        }
      }
    ) {
      affected_rows
    }
  }
`;

const getUserTyping = gql`
  subscription ($selfusername: String ) {
    user_typing (
      where: {
        username: {
          _neq: $selfusername
        }
      },
      limit: 1
      order_by: {last_typed:desc}
    ){
      last_typed
      username
    }
  }
`;

const fetchOnlineUsersSubscription = gql`
  subscription {
    user_online (
      order_by: {username:asc}
    ) {
      id
      username
    }
  }
`;

class Index extends React.Component {
  constructor (props) {
    super(props);
    this.state={
      loggedIn:false,
      username:"",
      text:"",
      messages:[],
      newMessages: [],
      error: null,
      first:true
    }

    this.usernameChange=this.usernameChange.bind(this);
    this.handleTyping=this.handleTyping.bind(this);
    this.addOldMessages=this.addOldMessages.bind(this);
  }

  addOldMessages = (messages) => {
    console.log("messagesss",messages)
    const oldMessages = [ ...this.state.messages, ...messages];
    this.setState({
      messages: oldMessages,
      newMessages: []
    })
  }

  addNewMessages = (messages) => {
    const newMessages = [...this.state.newMessages];
    messages.forEach((m) => {
      // do not add new messages from self
      if (m.username !== this.props.username) {
        newMessages.push(m);
      }
    });
    this.setState({
      newMessages
    })
  }

  handleTyping = (text, mutate) => {
    const textLength = text.length;
    if ((textLength !== 0 && textLength % 5 === 0) || textLength === 1) {
      this.emitTypingEvent(mutate);
    }
    this.setState({ text });
  }

  emitTypingEvent = async (mutate) => {
    if (this.state.username) {
      await mutate({
        mutation: emitTypingEvent,
        variables: {
          username: this.state.username
        }
      });
    }
  }

  usernameChange(e){
    this.setState({username:e.target.value});
  }


  getLastReceivedVars = () => {
    const { messages, newMessages } = this.state;
    if (newMessages.length === 0) {
      if (messages.length !== 0) {
        return {
          last_received_id: messages[messages.length - 1].id,
          last_received_ts: messages[messages.length - 1].timestamp
        }
      } else {
        return {
          last_received_id: -1,
          last_received_ts: "2018-08-21T19:58:46.987552+00:00"
        }
      }
    } else {
      return {
        last_received_id: newMessages[newMessages.length - 1].id,
        last_received_ts: newMessages[newMessages.length - 1].timestamp
      }
    }
  }


  fetchMessagesQuery(){
    fetch('https://data.condense57.hasura-app.io/v1alpha1/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer f3f938a9d6a7a2849f7193d4d74f4012f01110e28466d30b`,
        'X-Hasura-Role': 'admin'
      },
      body: JSON.stringify({
        query:fetchMessages,
        variables: this.getLastReceivedVars()
      })
    })
      .then(r => r.json())
      .then(data =>{
        // console.log("dm",data.data.message)
        this.addOldMessages(data.data.message)
      });
  }
  
  componentWillMount(){
    this.fetchMessagesQuery();
  }

  async componentDidMount() {
    console.log(localStorage.getItem("username"))
    if(localStorage.getItem("username")){
      this.setState({
        loggedIn:true,
        user_id:localStorage.getItem("user_id"),
        public:false,
      });
    }
    else{
      this.setState({
        loggedIn:false
      });
    }
    // Emit and event saying the user is online every 5 seconds
    setInterval(
      async () => {
              if(localStorage.getItem("username")){
                await fetch('https://data.condense57.hasura-app.io/v1alpha1/graphql', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': `Bearer f3f938a9d6a7a2849f7193d4d74f4012f01110e28466d30b`,
                  'X-Hasura-Role': 'admin'
                },
                body: JSON.stringify({
                  query:emitOnlineEvent,
                  variables: {
                      username:this.state.username,
                  }
                })
              })
              .then(r => r.json())
              .then(data => console.log("last seen updated"));
              }
      },
      3000
    );
  }


  
  form = (sendMessage, client) => {
    return (
      <form onSubmit={sendMessage}>
        <div className="textboxWrapper">
          <input
            id="textbox"
            className="textbox typoTextbox"
            value={this.state.text}
            autoFocus={true}
            onChange={(e) => {
              this.handleTyping(e.target.value, client.mutate);
            }}
            autoComplete="off"
          />
          <button
            className="sendButton typoButton"
            onClick={sendMessage}
          > Send </button>
        </div>
      </form>
    );
    }

  render () {
    return (
      <div>
        <Head>
          <title>Real Time Chat App</title>
          <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css" integrity="sha384-BVYiiSIFeK1dGmJRAkycuHAHRg32OmUcww7on3RYdg4Va+PmSTsz/K68vbdEjh4u" crossorigin="anonymous"/>
          <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap-theme.min.css" integrity="sha384-rHyoN1iRsVXV4nD0JutlnGaslCJuC7uwjduW9SVrLvRYooPp2bWYgmgJQIXwl/Sp" crossorigin="anonymous"></link>
        </Head>
        <Navbar bg="dark">
          <Navbar.Brand inline>Chat App</Navbar.Brand>
        </Navbar>
        {this.state.loggedIn?
        <div>
          <h1>Hi {localStorage.getItem("username")}</h1>
          <Mutation mutation={LOGOUT_USER}>
              {(logoutUser, {loading, error, data}) => {
                if (data) {
                  console.log(data);
                  alert("Logged Out");
                  this.setState({loggedIn:false});
                  localStorage.removeItem("username");
                }
                if (loading) {
                  return (<span><Button bsStyle="primary" disabled>Loading...</Button>&nbsp;&nbsp;</span>);
                }
                if (error) {
                  return (<span><Button bsStyle="primary" >Try again: {error.toString()}</Button>&nbsp;&nbsp;</span>);
                }

                return (
                  <span>
                    <Button
                      bsStyle="primary"
                      onClick={(e) => {
                        logoutUser({
                          variables: {
                            username:this.state.username,
                          }})
                      }}>
                      Logout
                    </Button>&nbsp;&nbsp;
                  </span>
                );
              }}
            </Mutation>
            <div className="container">
              <Row>
                <Col sm={4}>
                <h1>Online Users</h1>
                
                <Table striped bordered hover>
                  <thead>
                    <tr>
                      <th>Username</th>
                    </tr>
                  </thead>
                  <tbody>
                  <Subscription subscription={fetchOnlineUsersSubscription}>
                        {
                          ({data, error, loading }) => {
                            if (loading) {
                              return null;
                            }
                            if (error) { return "Error loading online users"; }
                            if(data.user_online.length==0){
                              return "No Online Users";
                            }
                            return (
                              data.user_online.map((u) => {
                                return  <tr key={u.id}><td>{u.username}</td></tr>
                              })
                            );
                          }
                        }
                      </Subscription>
                   
                  </tbody>
                </Table>
                </Col>
                <Col sm={8}>
                <div>
                    {
                      this.state.messages.map((m, i) => {
                        return (
                          <div key={m.id} className="message">
                            <div className="messageNameTime">
                              <div className="messageName">
                                <b>{m.username}</b>
                              </div>
                              <div className="messsageTime">
                                <i>{distanceInWordsToNow(parse(m.timestamp),{addSuffix: true})} </i>
                              </div>
                            </div>
                            <div className="messageText">
                              {m.text }
                            </div>
                          </div>
                        );
                      })
                    }
                    <Subscription subscription={subscribeToNewMessages}>
                        {
                          ({data, error, loading }) => {
                            if (loading) {
                              return null;
                            }
                            if (error) { return "Error loading messages"; }
                            if(data.message.length==0){
                              return "";
                            }
                            if(this.state.messages[this.state.messages.length-1].id!==data.message[0].id){
                              this.fetchMessagesQuery();
                            }
                            return (
                              ""
                            );
                          }
                        }
                    </Subscription>
                  <Subscription
                    subscription={getUserTyping}
                    variables={{
                      selfusername: this.state.username
                    }}
                  >
                    {
                      ({ data, loading, error}) => {
                        if (loading) { return ""; }
                        if (error) { return ""; }
                        if (data.user_typing.length === 0) {
                          return "";
                        } else {
                          return `${data.user_typing[0].username} is typing ...`;
                        }
                      }
                    }
                  </Subscription>
                </div>
                <Mutation
                  mutation={insertMessage}
                  variables={{
                    message: {
                      username: this.state.username,
                      text: this.state.text
                    }
                  }}
                  update={(cache, { data: { insert_message }}) => {
                    this.props.mutationCallback(
                      {
                        id: insert_message.returning[0].id,
                        timestamp: insert_message.returning[0].timestamp,
                        username: insert_message.returning[0].username,
                        text: insert_message.returning[0].text,
                      }
                    );
                  }}
                >
                {
                  (insert_message, { data, loading, error, client}) => {
                    const sendMessage = (e) => { 
                      e.preventDefault();
                      if (this.state.text === '') {
                        return;
                      }
                      insert_message();
                      this.setState({
                        text: ""
                      });
                    }
                    return this.form(sendMessage, client);
                  }
                }

              </Mutation>
                </Col>
              </Row>
            </div>
        </div>
        :
        <div>
          <input onChange={(e)=>this.usernameChange(e)} name="username" id="username"/>&nbsp;&nbsp;
          <Mutation mutation={ADD_USER}>
              {(AddUser, {loading, error, data}) => {
                if (data) {
                  console.log("data",data);
                  this.setState({loggedIn:true});
                  localStorage.setItem("username",this.state.username);
                }
                if (loading) {
                  return (<span><Button bsStyle="primary" disabled>Loading...</Button>&nbsp;&nbsp;</span>);
                }
                if (error) {
                  return (<span><Button bsStyle="primary" >Try again: {error.toString()}</Button>&nbsp;&nbsp;</span>);
                }

                return (
                  <span>
                    <Button
                      bsStyle="primary"
                      onClick={(e) => {
                        if(this.state.username==""){
                          alert("Text field cannot be empty");
                          return;
                        }
                        AddUser({
                          variables: {
                            username:this.state.username,
                          }})
                      }}>
                      Join
                    </Button>&nbsp;&nbsp;
                  </span>
                );
              }}
            </Mutation>

        </div>
        }
      </div>
    );
  }
}
export default withData(Index);