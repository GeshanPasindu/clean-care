import React from "react";
import Swal from "sweetalert2";

const SweetAlert = ({
  title,
  text,
  icon,
  confirmButtonText,
  handleConfirm,
}) => {
  const handleConfirmClick = () => {
    Swal.fire({
      title,
      text,
      icon,
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText,
    }).then((result) => {
      if (result.isConfirmed) {
        handleConfirm();
      }
    });
  };

  return <button onClick={handleConfirmClick}>Show SweetAlert</button>;
};

export default SweetAlert;
