import React from 'react';
import './App.css'; // Import your CSS file
import firebase from './firebase';
import { getDatabase, ref, push, serverTimestamp, update, remove } from "firebase/database";
import chatIcon from './chatus.png'; // Import your chat icon image

class ChatApp extends React.Component {
    state = {
        user: null,
        messages: [],
        newMessage: '',
        loading: false,
        email: '',
        password: '',
        selectedMessageId: null, // Store the ID of the selected message
        contextMenuVisible: false // Flag to control the visibility of the context menu
    };

    componentDidMount() {
        firebase.auth().onAuthStateChanged(user => {
            if (user) {
                this.setState({ user });
                this.fetchMessages();
            } else {
                this.setState({ user: null });
            }
        });
    }

    fetchMessages = () => {
        const messagesRef = firebase.database().ref('messages');
        messagesRef.on('value', async snapshot => {
            const messages = snapshot.val();
            if (messages) {
                const messagesWithUsers = await Promise.all(Object.values(messages).map(async message => {
                    const userSnapshot = await firebase.database().ref(`users/${message.userId}`).once('value');
                    const userData = userSnapshot.val();
                    const senderEmail = userData ? userData.email.split('@')[0] : 'Unknown';
                    return {
                        ...message,
                        senderEmail: senderEmail
                    };
                }));
                this.setState({ messages: messagesWithUsers });
            }
        });
    };

    handleChange = (e) => {
        this.setState({ newMessage: e.target.value });
    };

    handleSubmit = (e) => {
        e.preventDefault();
        const { newMessage, user } = this.state;

        if (!user) {
            // Handle case where user is not authenticated
            return;
        }

        if (newMessage.trim() === '') {
            return;
        }

        this.setState({ loading: true });

        const db = getDatabase();
        const messagesRef = ref(db, 'messages');
        const currentUserEmail = user.email;

        push(messagesRef, {
            text: newMessage,
            userId: user.uid,
            email: currentUserEmail,
            timestamp: serverTimestamp()
        })
            .then(() => {
                this.setState({
                    newMessage: '',
                    loading: false
                });
            })
            .catch(error => {
                console.error('Error sending message:', error);
                this.setState({ loading: false });
            });
    };

    handleEmailLogin = async () => {
        const { email, password } = this.state;
        try {
            await firebase.auth().signInWithEmailAndPassword(email, password);
            const currentUser = firebase.auth().currentUser;
            if (currentUser) {
                await firebase.database().ref(`users/${currentUser.uid}`).set({
                    email: currentUser.email
                });
            }
        } catch (error) {
            console.error('Error logging in:', error);
        }
    };

    handleLogout = async () => {
        try {
            await firebase.auth().signOut();
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };

    handleContextMenu = (e, messageId) => {
        e.preventDefault();
        // Show context menu options
        this.setState({
            selectedMessageId: messageId,
            contextMenuVisible: true
        });
    };

    handleDeleteMessage = () => {
        const { selectedMessageId } = this.state;
        const db = getDatabase();
        const messageRef = ref(db, `messages/${selectedMessageId}`);
        remove(messageRef);
        // Close the context menu
        this.setState({
            selectedMessageId: null,
            contextMenuVisible: false
        });
    };

    handleEditMessage = (newText) => {
        const { selectedMessageId } = this.state;
        const db = getDatabase();
        const messageRef = ref(db, `messages/${selectedMessageId}`);
        update(messageRef, { text: newText });
        // Close the context menu
        this.setState({
            selectedMessageId: null,
            contextMenuVisible: false
        });
    };

    handleEmojiClick = (emoji) => {
        this.setState(prevState => ({
            newMessage: prevState.newMessage + emoji
        }));
    };

    render() {
      const { messages, newMessage, loading, user, email, password, contextMenuVisible } = this.state;
  
      return (
          <div className="app-container container">
              <nav className="navbar">
                  <img src={chatIcon} alt="Chat Icon" className="chat-icon" style={{ width: '50px', height: '50px' }} />
                  {user && (
                      <button className="logout-button" onClick={this.handleLogout}>Logout</button>
                  )}
              </nav>
              <div className="chat-container">
                  {user && (
                      <div className="message-container">
                          {messages.map((message, index) => (
                              <div
                                  key={index}
                                  className={`message-bubble ${message.userId === user?.uid ? 'your-message' : 'other-user-message'}`}
                                  onContextMenu={e => this.handleContextMenu(e, message.id)} // Pass the message id to the context menu handler
                              >
                                  <span className="message-sender">{message.userId === user?.uid ? 'You' : message.senderEmail}: </span>
                                  {message.text}
                                  <span className="message-time">{new Date(message.timestamp).toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true })}</span>
                              </div>
                          ))}
                      </div>
                  )}
  
                  {user ? (
                      <form className="message-input" onSubmit={this.handleSubmit}>
                          <input
                              type="text"
                              placeholder="Type your message..."
                              value={newMessage}
                              onChange={this.handleChange}
                              disabled={loading}
                          />
                          <button type="submit" disabled={loading}>Send</button>
                      </form>
                  ) : (
                      <div className="login-form">
                          <input
                              type="email"
                              placeholder="Email"
                              value={email}
                              onChange={e => this.setState({ email: e.target.value })}
                          />
                          <input
                              type="password"
                              placeholder="Password"
                              value={password}
                              onChange={e => this.setState({ password: e.target.value })}
                          />
                          <button className="login-button" onClick={this.handleEmailLogin}>Login</button>
                      </div>
                  )}
                  {contextMenuVisible && (
                      <div className="context-menu">
                          <button className="context-menu-item" onClick={this.handleDeleteMessage}>Delete</button>
                          <button className="context-menu-item" onClick={() => this.handleEditMessage('New text')}>Edit</button>
                          <button className="context-menu-item" onClick={() => this.handleEmojiClick('😊')}>😊</button>
                      </div>
                  )}
              </div>
          </div>
      );
  }
  
}

export default ChatApp;
