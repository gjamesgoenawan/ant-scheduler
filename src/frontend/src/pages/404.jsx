import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div 
      className="flex flex-col d-flex align-items-center justify-center bg-gray-200"
      style={{ textAlign: "center",
                height: "100vh",
       }}
    >
      <div className="container-fluid py-2"
        style={{
                maxWidth: "800px",
            }}>
        <div className='card'>
            <div className="card-body">
                <h6 className="text-6xl font-bold mb-0 mt-0">Well, this is awkward...</h6>
                <div className="text-xl mb-5">The requested page was not found.</div>

                <button
                    className="btn btn-primary mb-2"
                    style={{ maxWidth: "300px" }}
                    onClick={() => navigate("/home")}
                    >
                    Take me back!
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}
