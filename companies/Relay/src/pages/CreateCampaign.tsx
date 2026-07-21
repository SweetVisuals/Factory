import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const CreateCampaign = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/campaigns?create=true', { replace: true });
  }, [navigate]);

  return null;
};

export default CreateCampaign;
