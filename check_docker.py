import paramiko

def run_ssh_command(host, user, password, command):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(host, username=user, password=password)
        stdin, stdout, stderr = ssh.exec_command(command)
        print("STDOUT:")
        print(stdout.read().decode())
        print("STDERR:")
        print(stderr.read().decode())
    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()

if __name__ == '__main__':
    cmd = """
    sed -i 's/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=Longlonglong1!/' /root/supabase-relay-studio/.env
    cd /root/supabase-relay-studio
    docker compose stop
    docker compose up -d
    """
    run_ssh_command("db.relaysolutions.net", "root", "qHaNVfPfWL7U", cmd)
