import subprocess

from exceptions.DockerException import DockerException


class DockerService:
    @staticmethod
    def assert_docker_health():
        try:
            subprocess.run(["docker", "info"], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            subprocess.run(["docker", "compose", "version"], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception as e:
            raise DockerException(e)

