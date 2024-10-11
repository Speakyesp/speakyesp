import React from 'react';
import './App.css';
import firebase from './firebase';
import { getDatabase, ref, push, serverTimestamp } from "firebase/database";
import chatIcon from './chatus.png';
import { format, isToday, isYesterday } from 'date-fns'; // Date formatting

class ChatApp extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            user: null,
            messages: [],
            newMessage: '',
            loading: false,
            email: '',
            password: '',
            selectedMessageId: null,
            contextMenuVisible: false,
            otherUsersTyping: {},
            imageFile: null,
            showModal: false,
            modalImageURL: '',
            imagePreviewURL: '',
            hoveredMessageId: null,
            repliedMessage: null,
        };
        this.typingTimeouts = {};
        this.chatContainerRef = React.createRef();
    }

    componentDidMount() {
        firebase.auth().onAuthStateChanged(user => {
            if (user) {
                this.setState({ user });
                this.fetchMessages();
            } else {
                this.setState({ user: null });
            }
        });

        firebase.database().ref('typing').on('value', snapshot => {
            const typingData = snapshot.val();
            if (typingData) {
                this.setState({ otherUsersTyping: typingData });
            } else {
                this.setState({ otherUsersTyping: {} });
            }
        });
    }

    fetchMessages = () => {
        const messagesRef = firebase.database().ref('messages');
        messagesRef.orderByChild('timestamp').on('value', async snapshot => {
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

                this.setState({ messages: messagesWithUsers }, () => {
                    this.scrollToBottom(); // Scroll to the bottom after fetching messages
                });
            }
        });
    };

    handleSubmit = async (e) => {
        e.preventDefault();
        const { newMessage, user, imagePreviewURL, repliedMessage } = this.state;

        if (!user || (newMessage.trim() === '' && !imagePreviewURL)) return;

        this.setState({ loading: true });

        try {
            if (imagePreviewURL) {
                await this.sendMessageWithBase64Image(newMessage, user, imagePreviewURL, repliedMessage);
                this.setState({
                    imageFile: null,
                    imagePreviewURL: ''
                });
            } else {
                await this.sendMessage(newMessage, user, repliedMessage);
            }

            this.setState({
                newMessage: '',
                loading: false,
                repliedMessage: null,
            }, () => {
                this.scrollToBottom(); // Scroll to the bottom after sending a message
            });
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message. Please try again.');
            this.setState({ loading: false });
        }
    };

    scrollToBottom = () => {
        if (this.chatContainerRef.current) {
            this.chatContainerRef.current.scrollTop = this.chatContainerRef.current.scrollHeight;
        }
    };

    isScrolledToBottom = () => {
        const chatContainer = this.chatContainerRef.current;
        return chatContainer.scrollHeight - chatContainer.clientHeight <= chatContainer.scrollTop + 1;
    };

    handleChange = (e) => {
        const { user } = this.state;
        const newText = e.target.value;

        if (this.typingTimeouts[user.uid]) {
            clearTimeout(this.typingTimeouts[user.uid]);
        }

        firebase.database().ref('typing').child(user.uid).set(true);

        this.typingTimeouts[user.uid] = setTimeout(() => {
            firebase.database().ref('typing').child(user.uid).remove();
        }, 1000);

        this.setState({ newMessage: newText });
    };

    handleImageChange = (e) => {
        const file = e.target.files[0];

        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            this.setState({
                imageFile: file,
                imagePreviewURL: reader.result // Base64 string
            });
        };
        reader.readAsDataURL(file);
    };

    sendMessageWithBase64Image = (newMessage, user, imageBase64, repliedMessage) => {
        const db = getDatabase();
        const messagesRef = ref(db, 'messages');
        const currentUserEmail = user.email;

        push(messagesRef, {
            text: newMessage,
            userId: user.uid,
            email: currentUserEmail,
            timestamp: serverTimestamp(),
            imageBase64: imageBase64,
            repliedMessage: repliedMessage ? repliedMessage : null,
        })
        .then(() => {
            this.setState({
                newMessage: '',
                loading: false,
                repliedMessage: null,
            });
        })
        .catch(error => {
            console.error('Error sending message:', error);
            this.setState({ loading: false });
        });
    };

    sendMessage = (newMessage, user, repliedMessage) => {
        const db = getDatabase();
        const messagesRef = ref(db, 'messages');
        const currentUserEmail = user.email;

        push(messagesRef, {
            text: newMessage,
            userId: user.uid,
            email: currentUserEmail,
            timestamp: serverTimestamp(),
            repliedMessage: repliedMessage ? repliedMessage : null,
        })
        .then(() => {
            this.setState({
                newMessage: '',
                loading: false,
                repliedMessage: null,
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

    handleReplyToMessage = (message) => {
        this.setState({ repliedMessage: message });
    };

    // Grouping messages by date
    groupMessagesByDate = (messages) => {
        return messages.reduce((acc, message) => {
            const messageDate = new Date(message.timestamp);
            const dateKey = format(messageDate, 'yyyy-MM-dd');
            if (!acc[dateKey]) {
                acc[dateKey] = [];
            }
            acc[dateKey].push(message);
            return acc;
        }, {});
    };

    formatDateSeparator = (dateString) => {
        const date = new Date(dateString);
        if (isToday(date)) {
            return 'Today';
        } else if (isYesterday(date)) {
            return 'Yesterday';
        } else {
            return format(date, 'MMMM dd, yyyy');
        }
    };

    render() {
        const { messages, newMessage, loading, user, email, password, imagePreviewURL, repliedMessage } = this.state;
        const groupedMessages = this.groupMessagesByDate(messages);
        const fileInputRef = React.createRef();

        return (
            <div className="app-container container">
                <nav className="navbar">
                    <img src={chatIcon} alt="Chat Icon" className="chat-icon" style={{ width: '50px', height: '50px' }} />
                    {user && (
                        <button className="logout-button" onClick={this.handleLogout}>Logout</button>
                    )}
                </nav>
                <div className="chat-container" ref={this.chatContainerRef}>
                    {user && (
                        <div className="message-container">
                            {Object.keys(groupedMessages).map(dateKey => (
                                <React.Fragment key={dateKey}>
                                    <div className="date-separator">{this.formatDateSeparator(dateKey)}</div>
                                    {groupedMessages[dateKey].map((message, index) => (
                                        <div
                                            key={index}
                                            className={`message-bubble ${message.userId === user?.uid ? 'your-message' : 'other-user-message'}`}
                                        >
                                            <span className="message-sender">{message.userId === user?.uid ? 'You' : message.senderEmail}: </span>
                                            {message.text}
                                            {message.imageBase64 && (
                                                <div className="image-container">
                                                    <img src={message.imageBase64} alt="Shared" />
                                                </div>
                                            )}
                                            <span className="message-time">{format(new Date(message.timestamp), 'hh:mm a')}</span>
                                        </div>
                                    ))}
                                </React.Fragment>
                            ))}
                        </div>
                    )}
                </div>

                {user ? (
                    <div className="input-container">
                        {repliedMessage && (
                            <div className="replied-message">
                                <span>Replying to: {repliedMessage.text}</span>
                                <button onClick={() => this.setState({ repliedMessage: null })}>Cancel</button>
                            </div>
                        )}
                        <input
                            type="text"
                            value={newMessage}
                            onChange={this.handleChange}
                            placeholder="Type a message"
                        />
                        <input
                            type="file"
                            accept="image/*"
                            onChange={this.handleImageChange}
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                        />
                        <button onClick={() => fileInputRef.current.click()}>📷</button>
                        <button onClick={this.handleSubmit} disabled={loading}>
                            {loading ? 'Sending...' : 'Send'}
                        </button>
                        {imagePreviewURL && (
                            <div className="image-preview">
                                <img src={imagePreviewURL} alt="Preview" />
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="login-container">
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => this.setState({ email: e.target.value })}
                            placeholder="Email"
                        />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => this.setState({ password: e.target.value })}
                            placeholder="Password"
                        />
                        <button onClick={this.handleEmailLogin}>Login</button>
                    </div>
                )}
            </div>
        );
    }
}

export default ChatApp;
