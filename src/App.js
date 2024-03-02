import React from 'react';
import './App.css'; 
import firebase from './firebase';
import Modal from './Modal'; 
import { getDatabase, ref, push, serverTimestamp, update } from "firebase/database";
import { getMessaging, onMessage } from 'firebase/messaging';
import chatIcon from './chatus.png'; 

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
            repliedMessage: null, // State to store the replied message
        };
        this.typingTimeouts = {};
        this.chatContainerRef = React.createRef();
    }

    componentDidMount() {
        firebase.auth().onAuthStateChanged(user => {
            if (user) {
                this.setState({ user });
                this.fetchMessages();
                this.initFirebaseMessaging();
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

    initFirebaseMessaging = () => {
        const messaging = getMessaging();
        onMessage(messaging, (payload) => {
            console.log('Message received:', payload);
        });
    };

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
                    if (this.isScrolledToBottom()) {
                        this.scrollToBottom();
                    }
                });
            }
        });
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
        
        // Read the selected image file and generate a preview
        const reader = new FileReader();
        reader.onload = () => {
            this.setState({
                imageFile: file,
                imagePreviewURL: reader.result // Store the image preview URL in state
            });
        };
        reader.readAsDataURL(file); // Read the file as a Data URL

        // Reset imageFile state if no file is selected
        if (!file) {
            this.setState({
                imageFile: null,
                imagePreviewURL: ''
            });
        }
    };

    handleSubmit = async (e) => {
        e.preventDefault();
        const { newMessage, user, imageFile, repliedMessage } = this.state;
    
        if (!user) {
            return;
        }
    
        // If both text message and image are empty, return
        if (newMessage.trim() === '' && !imageFile) {
            return;
        }
    
        this.setState({ loading: true });
    
        try {
            if (imageFile) {
                // Upload the image
                const imageURL = await this.uploadImage(imageFile);
                // Send message with image URL
                await this.sendMessageWithImage(newMessage, user, imageURL, repliedMessage);
            } else {
                // Send text message only
                await this.sendMessage(newMessage, user, repliedMessage);
            }
    
            // Reset state after sending message
            this.setState({
                newMessage: '',
                loading: false,
                imageFile: null, // Reset imageFile state after sending message
                imagePreviewURL: '', // Reset imagePreviewURL state after sending message
                repliedMessage: null, // Clear replied message after sending
            });
        } catch (error) {
            console.error('Error sending message:', error);
            // Show error message to the user
            alert('Failed to send message. Please try again.');
            this.setState({ loading: false });
        }
    };

    uploadImage = (file) => {
        // Upload the image file to Firebase Storage
        return new Promise((resolve, reject) => {
            const storageRef = firebase.storage().ref();
            const imageRef = storageRef.child(`images/${file.name}`);
            imageRef.put(file)
                .then(snapshot => {
                    return snapshot.ref.getDownloadURL();
                })
                .then(downloadURL => {
                    resolve(downloadURL);
                })
                .catch(error => {
                    reject(error);
                });
        });
    };

    sendMessageWithImage = (newMessage, user, imageURL, repliedMessage) => {
        const db = getDatabase();
        const messagesRef = ref(db, 'messages');
        const currentUserEmail = user.email;

        push(messagesRef, {
            text: newMessage,
            userId: user.uid,
            email: currentUserEmail,
            timestamp: serverTimestamp(),
            imageURL: imageURL, // Add imageURL to the message data
            repliedMessage: repliedMessage ? repliedMessage : null, // Add replied message to the message data
        })
            .then(() => {
                this.setState({
                    newMessage: '',
                    loading: false,
                    imageFile: null, // Reset imageFile state after sending message
                    imagePreviewURL: '', // Reset imagePreviewURL state after sending message
                    repliedMessage: null, // Clear replied message after sending
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
            repliedMessage: repliedMessage ? repliedMessage : null, // Add replied message to the message data
        })
            .then(() => {
                this.setState({
                    newMessage: '',
                    loading: false,
                    repliedMessage: null, // Clear replied message after sending
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
        this.setState({
            selectedMessageId: messageId,
            contextMenuVisible: true
        });
    };

    handleDeleteMessage = (messageId) => {
        const db = firebase.database();
        const messageRef = db.ref(`messages/${messageId}`);
    
        // Remove the message node from the database
        messageRef.remove()
            .then(() => {
                console.log('Message deleted successfully');
            })
            .catch((error) => {
                console.error('Error deleting message:', error);
            });
    };
    
    
    

    handleEditMessage = (newText) => {
        const { selectedMessageId } = this.state;
        const db = getDatabase();
        const messageRef = ref(db, `messages/${selectedMessageId}`);
        update(messageRef, { text: newText });
        this.setState({
            selectedMessageId: null,
            contextMenuVisible: false
        });
    };

    handleLikeMessage = () => {
        const { selectedMessageId, user } = this.state;
        if (!user || !selectedMessageId) return;

        const db = getDatabase();
        const messageRef = ref(db, `messages/${selectedMessageId}/likes`);
        push(messageRef, {
            userId: user.uid,
            timestamp: serverTimestamp()
        }).then(() => {
            console.log('Message liked successfully');
            this.setState({ selectedMessageId: null });
        }).catch(error => {
            console.error('Error liking message:', error);
        });
    };

    handleHoverMessage = (messageId) => {
        this.setState({ hoveredMessageId: messageId });
    };

    handleCloseContextMenu = () => {
        this.setState({ contextMenuVisible: false });
    };

    closeModal = () => {
        this.setState({
            showModal: false,
            modalImageURL: '',
        });
    };

    handleScrollToEnd = () => {
        this.scrollToBottom();
    };

    handleReplyToMessage = (message) => {
        this.setState({ repliedMessage: message });
    };

    render() {
        const { messages, newMessage, loading, user, email, password, otherUsersTyping, showModal, modalImageURL, imagePreviewURL, hoveredMessageId, repliedMessage } = this.state;
    
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
                            {messages.map((message, index) => (
                                <div
                                    key={index}
                                    className={`message-bubble ${message.userId === user?.uid ? 'your-message' : 'other-user-message'}`}
                                    onContextMenu={e => this.handleContextMenu(e, message.id)}
                                    onMouseEnter={() => this.handleHoverMessage(message.id)}
                                    onMouseLeave={this.handleCloseContextMenu}
                                >
                                    <span className="message-sender">{message.userId === user?.uid ? 'You' : message.senderEmail}: </span>
                                    {message.text}
                                    {message.imageURL && (
                                        <div className="image-container">
                                            <img src={message.imageURL} alt="Shared" />
                                        </div>
                                    )}
                                    {message.repliedMessage && (
                                        <div className="replied-message">
                                            <p>{message.repliedMessage.senderEmail}: {message.repliedMessage.text}</p>
                                        </div>
                                    )}
                                    <span className="message-time">{new Date(message.timestamp).toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true })}</span>
                                    {hoveredMessageId === message.id && (
                                        <div className="message-options">
                                            <button onClick={() => this.handleDeleteMessage(message.id)}>Delete</button>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {Object.keys(otherUsersTyping).map(userId => (
                                userId !== user.uid && <div key={userId} className="typing-indicator">typing...</div>
                            ))}
                        </div>
                    )}
    
                    {user ? (
                        <form className="message-input" onSubmit={this.handleSubmit}>
                            {repliedMessage && (
                                <div className="replied-message-preview">
                                    <p>{repliedMessage.senderEmail}: {repliedMessage.text}</p>
                                    <button onClick={() => this.setState({ repliedMessage: null })}>Cancel Reply</button>
                                </div>
                            )}
                            <input
                                type="text"
                                placeholder="Type your message..."
                                value={newMessage}
                                onChange={this.handleChange}
                                disabled={loading}
                            />
                            <label htmlFor="file-upload" className="upload-button">@</label>
                            <input
                                id="file-upload"
                                type="file"
                                accept="image/*"
                                onChange={this.handleImageChange}
                                style={{ display: 'none' }}
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
                </div>
                {showModal && (
                    <Modal imageURL={modalImageURL} closeModal={this.closeModal} />
                )}
                {imagePreviewURL && (
                    <div className="image-preview">
                        <img src={imagePreviewURL} alt="Selected" />
                    </div>
                )}
            </div>
        );
    }
}

export default ChatApp;
