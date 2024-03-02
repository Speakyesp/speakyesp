import React from 'react';

class Modal extends React.Component {
    render() {
        const { imageURL, closeModal } = this.props;
        return (
            <div className="modal-overlay" onClick={closeModal}>
                <div className="modal-content">
                    <img src={imageURL} alt="Full size" className="full-size-image" />
                </div>
            </div>
        );
    }
}

export default Modal;
