import Swal, { type SweetAlertIcon } from "sweetalert2";

const SweetAlert = ({
  title,
  text,
  icon,
  confirmButtonText,
  handleConfirm,
}: {
  title: string;
  text: string;
  icon: SweetAlertIcon;
  confirmButtonText: string;
  handleConfirm: () => void;
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
